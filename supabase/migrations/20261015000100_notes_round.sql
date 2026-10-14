-- =====================================================================
-- OPSUYON  |  09 · Müşteri notları turu
--   · Danışma ve Tesis Yönetimi hizmet alanı
--   · Merkez personeline kişiye özel yetki
--   · Bitiş tarihi geçen projeleri otomatik pasife alma
--   · Cari hesap: muhasebenin yüklediği Excel ekstresi (son satır = güncel bakiye)
--   · Yıllık izin kayıtları (evrak, işe başlama tarihi, kategori)
-- =====================================================================

-- ---------- 1. yeni hizmet alanı ----------
insert into public.service_lines (code, name, description, icon, sort_order) values
  ('danisma_tesis', 'Danışma ve Tesis', 'Danışma ve tesis yönetimi hizmetleri', 'building-2', 40)
on conflict (code) do nothing;

-- ---------- 2. kişiye özel merkez yetkisi ----------
create table public.staff_permission_overrides (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  permission_code text not null references public.permissions (code) on delete cascade on update cascade,
  is_allowed      boolean not null,
  primary key (user_id, permission_code)
);
alter table public.staff_permission_overrides enable row level security;

create policy staff_overrides_read on public.staff_permission_overrides for select to authenticated
  using (user_id = auth.uid() or app.has_global_permission('users.read'));
create policy staff_overrides_write on public.staff_permission_overrides for all to authenticated
  using (app.has_global_permission('users.manage')) with check (app.has_global_permission('users.manage'));

-- rol = şablon; kişiye özel "izin ver / engelle" rolün üstüne yazar (super_admin hariç)
create or replace function app.has_global_permission(perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.staff_role_id
    where p.id = auth.uid()
      and p.kind = 'staff'
      and p.is_active
      and (
        r.code = 'super_admin'
        or coalesce(
             (select o.is_allowed from public.staff_permission_overrides o
               where o.user_id = p.id and o.permission_code = perm),
             exists (select 1 from public.role_permissions rp
                      where rp.role_id = r.id and rp.permission_code = perm)
           )
      )
  )
$$;

create trigger audit_staff_overrides after insert or update or delete on public.staff_permission_overrides
  for each row execute function app.audit_row();

-- ---------- 3. bitmiş projeleri otomatik pasife al ----------
create or replace function public.close_expired_projects()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare n integer;
begin
  update public.projects
     set status = 'closed'
   where status in ('active', 'paused')
     and end_date is not null
     and end_date < current_date;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.close_expired_projects() from public, anon;
grant  execute on function public.close_expired_projects() to authenticated, service_role;

-- günlük çalışsın (pg_cron yoksa uygulama giriş sırasında da çağırır)
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('close-expired-projects', '5 0 * * *', 'select public.close_expired_projects()');
exception when others then
  raise notice 'pg_cron kurulamadı (%): uygulama tarafı yedeği kullanılacak', sqlerrm;
end $$;

select public.close_expired_projects();

-- ---------- 4. cari hesap: Excel ekstre ----------
create table public.ledger_statements (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  file_name       text not null,
  storage_path    text,
  row_count       int not null default 0,
  closing_balance numeric(14,2) not null default 0,   -- ekstrenin SON satır bakiyesi
  as_of_date      date,
  is_current      boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create unique index ledger_statements_current_key on public.ledger_statements (project_id) where is_current;
create index ledger_statements_project_idx on public.ledger_statements (project_id, created_at desc);

create table public.ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.ledger_statements (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  row_no       int not null,
  entry_date   date not null,
  ref_no       text,
  description  text,
  debit        numeric(14,2) not null default 0,
  credit       numeric(14,2) not null default 0,
  balance      numeric(14,2) not null
);
create index ledger_entries_statement_idx on public.ledger_entries (statement_id, row_no);

alter table public.ledger_statements enable row level security;
alter table public.ledger_entries    enable row level security;

create policy ledger_statements_read on public.ledger_statements for select to authenticated
  using (app.has_project_permission(project_id, 'ledger.read'));
create policy ledger_statements_write on public.ledger_statements for all to authenticated
  using (app.has_global_permission('finance.manage')) with check (app.has_global_permission('finance.manage'));
create policy ledger_entries_read on public.ledger_entries for select to authenticated
  using (app.has_project_permission(project_id, 'ledger.read'));
create policy ledger_entries_write on public.ledger_entries for all to authenticated
  using (app.has_global_permission('finance.manage')) with check (app.has_global_permission('finance.manage'));

create trigger audit_ledger_statements after insert or update or delete on public.ledger_statements
  for each row execute function app.audit_row();

-- aynı imza: eski çağıranlar (proje sayfası, cari hesap) değişmeden çalışır
create or replace function public.account_statement(p_project_id uuid)
returns table (
  entry_date  date,
  kind        text,
  ref_no      text,
  description text,
  debit       numeric,
  credit      numeric,
  balance     numeric
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not app.has_project_permission(p_project_id, 'ledger.read') then
    raise exception 'Bu projenin cari hesabını görüntüleme yetkiniz yok.' using errcode = '42501';
  end if;

  return query
  select e.entry_date,
         case when e.debit > 0 then 'fatura' else 'odeme' end,
         e.ref_no, e.description, e.debit, e.credit, e.balance
  from public.ledger_entries e
  join public.ledger_statements s on s.id = e.statement_id
  where s.project_id = p_project_id and s.is_current
  order by e.row_no;
end;
$$;
revoke execute on function public.account_statement(uuid) from public, anon;
grant  execute on function public.account_statement(uuid) to authenticated;

-- ---------- 5. yıllık izin kayıtları ----------
alter table public.leave_records
  add column return_date date,
  add column project_id  uuid references public.projects (id) on delete set null,
  add column document_id uuid references public.documents (id) on delete set null,
  add column created_by  uuid references public.profiles (id) on delete set null;

alter table public.leave_records drop constraint if exists leave_records_leave_type_check;
alter table public.leave_records add constraint leave_records_leave_type_check
  check (leave_type in ('yillik', 'ucretsiz', 'raporlu', 'mazeret', 'evlilik', 'dogum', 'olum', 'diger'));
alter table public.leave_records drop constraint if exists leave_records_days_check;
alter table public.leave_records add constraint leave_records_days_check check (days > 0);
alter table public.leave_records add constraint leave_records_return_check check (return_date is null or return_date >= end_date);

create index leave_records_project_idx on public.leave_records (project_id, start_date desc);
create trigger audit_leave_records after insert or update or delete on public.leave_records
  for each row execute function app.audit_row();
