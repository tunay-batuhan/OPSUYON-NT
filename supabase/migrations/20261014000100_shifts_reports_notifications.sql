-- =====================================================================
-- OPSUYON  |  08 · Vardiya planı, raporlar, bildirim sayaçları
-- =====================================================================

-- ---------- new permissions ----------
insert into public.permissions (code, module, description, sort_order) values
  ('shifts.read',    'personel', 'Vardiya planını görüntüle',        40),
  ('shifts.manage',  'personel', 'Vardiya planını düzenle',          41),
  ('reports.read',   'raporlar', 'Raporları görüntüle / indir',      80)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from (values
  ('manager',          'shifts.read'), ('manager',          'shifts.manage'), ('manager',          'reports.read'),
  ('operator',         'shifts.read'), ('operator',         'shifts.manage'), ('operator',         'reports.read'),
  ('accountant',       'reports.read'),
  ('customer_manager', 'shifts.read'), ('customer_manager', 'reports.read'),
  ('customer_hr',      'shifts.read'), ('customer_hr',      'reports.read'),
  ('customer_finance', 'reports.read'),
  ('customer_viewer',  'shifts.read')
) as p(role_code, code)
join public.roles r on r.code = p.role_code
on conflict do nothing;

-- ---------- shift catalog (data, not enum: add a shift = insert a row) ----------
create table public.shift_types (
  code       text primary key check (code ~ '^[A-Z0-9]{1,3}$'),
  name       text not null,
  start_time time,
  end_time   time,
  color      text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_off     boolean not null default false,       -- izin / rapor gibi çalışılmayan günler
  sort_order int not null default 100,
  is_active  boolean not null default true
);

insert into public.shift_types (code, name, start_time, end_time, color, is_off, sort_order) values
  ('G', 'Gündüz (8 saat)',  '08:00', '16:00', '#1f6fe5', false, 10),
  ('A', 'Akşam (8 saat)',   '16:00', '00:00', '#f58a1f', false, 20),
  ('N', 'Gece (8 saat)',    '00:00', '08:00', '#7c3aed', false, 30),
  ('D', 'Gündüz (12 saat)', '08:00', '20:00', '#0ea5e9', false, 40),
  ('E', 'Gece (12 saat)',   '20:00', '08:00', '#4f46e5', false, 50),
  ('H', 'Haftalık izin',    null,    null,    '#94a3b8', true,  60),
  ('Y', 'Yıllık izin',      null,    null,    '#1fa255', true,  70),
  ('R', 'Raporlu',          null,    null,    '#e11d48', true,  80);

create table public.shift_assignments (
  project_id   uuid not null references public.projects (id) on delete cascade,
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  work_date    date not null,
  shift_code   text not null references public.shift_types (code) on update cascade,
  note         text,
  updated_at   timestamptz not null default now(),
  primary key (project_id, personnel_id, work_date)
);
create index shift_assignments_project_date_idx on public.shift_assignments (project_id, work_date);
create trigger shift_assignments_updated_at before update on public.shift_assignments
  for each row execute function app.set_updated_at();

alter table public.shift_types       enable row level security;
alter table public.shift_assignments enable row level security;

create policy shift_types_read on public.shift_types for select to authenticated
  using (app.current_profile_active());
create policy shift_types_write on public.shift_types for all to authenticated
  using (app.has_global_permission('access.manage')) with check (app.has_global_permission('access.manage'));

create policy shift_assignments_read on public.shift_assignments for select to authenticated
  using (app.has_project_permission(project_id, 'shifts.read'));
create policy shift_assignments_write on public.shift_assignments for all to authenticated
  using (app.has_global_permission('shifts.manage')) with check (app.has_global_permission('shifts.manage'));

-- ---------- menu gating: union of the caller's permissions over all projects ----------
create or replace function public.my_permission_union()
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x.code order by x.code), '{}')
  from (
    select pm.code from public.permissions pm where app.has_global_permission(pm.code)
    union
    select pm.code
    from public.permissions pm
    join public.project_members m on m.user_id = auth.uid()
    where app.has_project_permission(m.project_id, pm.code)
  ) x
$$;

-- ---------- bell badge: one cheap call for the whole shell ----------
create or replace function public.my_notification_counts()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_kind text;
  v_threads int := 0;
  v_contracts int := 0;
  v_docs int := 0;
begin
  select kind into v_kind from public.profiles where id = uid and is_active;
  if v_kind is null then
    return jsonb_build_object('unread_threads', 0, 'upcoming_contracts', 0, 'new_documents', 0);
  end if;

  select count(*) into v_threads
  from public.threads t
  where app.can_access_thread(t.id)
    and exists (
      select 1 from public.messages m
      where m.thread_id = t.id and m.sender_id <> uid
        and m.created_at > coalesce((select r.last_read_at from public.thread_reads r where r.thread_id = t.id and r.user_id = uid), 'epoch'::timestamptz)
    );

  select count(*) into v_contracts
  from public.projects p
  where p.status = 'active'
    and p.end_date between current_date and current_date + 60
    and app.has_project_permission(p.id, 'projects.read');

  if v_kind = 'customer' then
    select count(*) into v_docs
    from public.documents d
    where d.created_at > now() - interval '7 days' and app.can_read_document(d);
  end if;

  return jsonb_build_object('unread_threads', v_threads, 'upcoming_contracts', v_contracts, 'new_documents', v_docs);
end;
$$;

revoke execute on function public.my_permission_union(), public.my_notification_counts() from public, anon;
grant  execute on function public.my_permission_union(), public.my_notification_counts() to authenticated;
