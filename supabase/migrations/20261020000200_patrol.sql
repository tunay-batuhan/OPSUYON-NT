-- Devriye Sistemi: noktalar (barkod/QR), telefonla okutma kaydı, günlük rapor (PDF uygulama tarafında üretilir).
--  * Devriye görevlisi telefonundan her noktadaki barkodu okutur (patrol.scan)
--  * Merkez noktaları tanımlar ve barkod etiketlerini yazdırır (patrol.manage)
--  * Müşteri ve merkez günlük devriye raporunu görür / PDF indirir (patrol.read)

-- ---------- izinler ve rol ----------
insert into public.permissions (code, module, description, sort_order) values
  ('patrol.read',   'devriye', 'Devriye raporlarını görüntüle ve PDF indir',          60),
  ('patrol.scan',   'devriye', 'Devriye noktalarında barkod okut',                    61),
  ('patrol.manage', 'devriye', 'Devriye noktalarını tanımla ve barkod etiketi yazdır', 62)
on conflict (code) do nothing;

insert into public.roles (code, name, scope, description, is_system) values
  ('customer_patrol', 'Devriye Görevlisi', 'customer', 'Yalnızca devriye noktalarındaki barkodu okutur.', true)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from (values
  ('manager',          'patrol.read'),
  ('manager',          'patrol.manage'),
  ('operator',         'patrol.read'),
  ('operator',         'patrol.manage'),
  ('customer_manager', 'patrol.read'),
  ('customer_manager', 'patrol.scan'),
  ('customer_patrol',  'patrol.scan'),
  ('customer_patrol',  'projects.read')   -- giriş için projesini görebilmeli (menüde Projeler açılmaz)
) as p(role_code, code)
join public.roles r on r.code = p.role_code
on conflict do nothing;

-- ---------- noktalar ----------
create table public.patrol_points (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 80),
  code       text not null unique check (code ~ '^[A-Z0-9-]{6,32}$'),   -- barkod / QR içeriği
  sort_order int  not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patrol_points_project_idx on public.patrol_points (project_id, sort_order);
create trigger patrol_points_updated_at before update on public.patrol_points
  for each row execute function app.set_updated_at();
create trigger audit_patrol_points after insert or update or delete on public.patrol_points
  for each row execute function app.audit_row();

-- ---------- okutma kayıtları ----------
create table public.patrol_scans (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  point_id   uuid not null references public.patrol_points (id) on delete cascade,
  scanned_by uuid references public.profiles (id) on delete set null,
  scanned_at timestamptz not null default now()
);
create index patrol_scans_project_time_idx on public.patrol_scans (project_id, scanned_at desc);
create index patrol_scans_point_idx        on public.patrol_scans (point_id, scanned_at desc);
create index patrol_scans_user_idx         on public.patrol_scans (scanned_by, scanned_at desc);

alter table public.patrol_points enable row level security;
alter table public.patrol_scans  enable row level security;

create policy patrol_points_read on public.patrol_points for select to authenticated
  using (app.has_project_permission(project_id, 'patrol.read') or app.has_project_permission(project_id, 'patrol.scan'));
create policy patrol_points_write on public.patrol_points for all to authenticated
  using (app.has_global_permission('patrol.manage')) with check (app.has_global_permission('patrol.manage'));

-- okutma kaydı yalnızca record_patrol_scan() ile eklenir (doğrudan insert politikası yok)
create policy patrol_scans_read on public.patrol_scans for select to authenticated
  using (app.has_project_permission(project_id, 'patrol.read') or scanned_by = auth.uid());
create policy patrol_scans_delete on public.patrol_scans for delete to authenticated
  using (app.has_global_permission('patrol.manage'));

-- ---------- barkod okut ----------
create or replace function public.record_patrol_scan(p_code text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_point   public.patrol_points;
  v_project text;
  v_last    timestamptz;
  v_now     timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '42501';
  end if;

  select * into v_point from public.patrol_points where code = upper(btrim(p_code)) and is_active;
  if not found then
    raise exception 'Bu barkod tanınmadı. Devriye noktasındaki etiketi okuttuğunuzdan emin olun.' using errcode = 'P0002';
  end if;
  if not app.has_project_permission(v_point.project_id, 'patrol.scan') then
    raise exception 'Bu noktayı okutma yetkiniz yok.' using errcode = '42501';
  end if;

  select name into v_project from public.projects where id = v_point.project_id;

  -- aynı kişi aynı noktayı 20 sn içinde tekrar okutursa (çift okuma) yeni kayıt açılmaz
  select max(scanned_at) into v_last from public.patrol_scans
   where point_id = v_point.id and scanned_by = auth.uid() and scanned_at > v_now - interval '20 seconds';
  if v_last is not null then
    return jsonb_build_object('point', v_point.name, 'project', v_project, 'scanned_at', v_last, 'duplicate', true);
  end if;

  insert into public.patrol_scans (project_id, point_id, scanned_by, scanned_at)
  values (v_point.project_id, v_point.id, auth.uid(), v_now);
  return jsonb_build_object('point', v_point.name, 'project', v_project, 'scanned_at', v_now, 'duplicate', false);
end;
$$;
revoke execute on function public.record_patrol_scan(text) from public, anon;
grant  execute on function public.record_patrol_scan(text) to authenticated;

-- ---------- modül anahtarı: istendi, kodlandı, açık ----------
update public.app_modules
   set implemented = true, enabled = true, sort_order = 85,
       name = 'Devriye Sistemi (Demo)',
       description = 'DEMO: henüz onaylanmadı. Barkod okutma, noktalar, günlük devriye raporu (PDF)'
 where code = 'devriye';
