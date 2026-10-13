-- =====================================================================
-- OPSUYON  |  05 · Timesheets, leaves, finance, imports
-- =====================================================================

-- ---------------------------------------------------------------------
-- Puantaj
-- ---------------------------------------------------------------------
create table public.timesheets (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  personnel_id   uuid not null references public.personnel (id) on delete cascade,
  period_year    smallint not null check (period_year between 2000 and 2100),
  period_month   smallint not null check (period_month between 1 and 12),
  worked_days    numeric(5,2) not null default 0 check (worked_days >= 0),
  leave_days     numeric(5,2) not null default 0 check (leave_days >= 0),
  absence_days   numeric(5,2) not null default 0 check (absence_days >= 0),
  overtime_hours numeric(6,2) not null default 0 check (overtime_hours >= 0),
  daily          jsonb not null default '{}'::jsonb,         -- {"1":"G","2":"İ",...} gün gün kodlar
  note           text,
  import_id      uuid,                                       -- FK added after imports table
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, personnel_id, period_year, period_month)
);
create index timesheets_project_period_idx on public.timesheets (project_id, period_year desc, period_month desc);
create trigger timesheets_updated_at before update on public.timesheets
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------
-- Yıllık izin
-- ---------------------------------------------------------------------
create table public.leave_balances (
  id            uuid primary key default gen_random_uuid(),
  personnel_id  uuid not null references public.personnel (id) on delete cascade,
  year          smallint not null check (year between 2000 and 2100),
  entitled_days numeric(5,1) not null default 0,
  carried_days  numeric(5,1) not null default 0,
  used_days     numeric(5,1) not null default 0,
  remaining_days numeric(5,1) generated always as (entitled_days + carried_days - used_days) stored,
  metadata      jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (personnel_id, year)
);
create trigger leave_balances_updated_at before update on public.leave_balances
  for each row execute function app.set_updated_at();

create table public.leave_records (
  id           uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  leave_type   text not null default 'yillik' check (leave_type in ('yillik', 'ucretsiz', 'raporlu', 'mazeret', 'diger')),
  start_date   date not null,
  end_date     date not null,
  days         numeric(5,1) not null check (days > 0),
  note         text,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_records_personnel_idx on public.leave_records (personnel_id, start_date desc);

-- ---------------------------------------------------------------------
-- Fatura / ödeme / cari hesap
-- ---------------------------------------------------------------------
create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete restrict,
  invoice_no   text not null,
  issue_date   date not null,
  due_date     date,
  period_year  smallint check (period_year between 2000 and 2100),
  period_month smallint check (period_month between 1 and 12),
  subtotal     numeric(14,2) not null check (subtotal >= 0),
  vat_rate     numeric(5,2)  not null default 20 check (vat_rate >= 0),
  vat_amount   numeric(14,2) not null check (vat_amount >= 0),
  total        numeric(14,2) not null check (total >= 0),
  currency     text not null default 'TRY',
  status       text not null default 'draft' check (status in ('draft', 'issued', 'cancelled')),
  document_id  uuid references public.documents (id) on delete set null,
  notes        text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, invoice_no)
);
create index invoices_project_idx on public.invoices (project_id, issue_date desc);
create trigger invoices_updated_at before update on public.invoices
  for each row execute function app.set_updated_at();

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete restrict,
  invoice_id  uuid references public.invoices (id) on delete set null,
  paid_on     date not null,
  amount      numeric(14,2) not null check (amount > 0),
  currency    text not null default 'TRY',
  method      text check (method in ('havale', 'eft', 'cek', 'nakit', 'kredi_karti', 'diger')),
  reference   text,
  document_id uuid references public.documents (id) on delete set null,
  notes       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index payments_project_idx on public.payments (project_id, paid_on desc);

-- Cari hesap ekstresi. SECURITY DEFINER so the running balance is always
-- computed over the FULL ledger, while access is gated by ledger.read.
create or replace function public.account_statement(p_project_id uuid)
returns table (
  entry_date  date,
  kind        text,       -- 'fatura' | 'odeme'
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
  with entries as (
    select i.issue_date as d, 'fatura'::text as k, i.invoice_no as r,
           coalesce(i.notes, 'Fatura') as descr, i.total as debit, 0::numeric as credit, 1 as ord, i.created_at as c
    from public.invoices i
    where i.project_id = p_project_id and i.status = 'issued'
    union all
    select p.paid_on, 'odeme', coalesce(p.reference, p.method, 'Ödeme'),
           coalesce(p.notes, 'Ödeme'), 0::numeric, p.amount, 2, p.created_at
    from public.payments p
    where p.project_id = p_project_id
  )
  select e.d, e.k, e.r, e.descr, e.debit, e.credit,
         sum(e.debit - e.credit) over (order by e.d, e.ord, e.c rows between unbounded preceding and current row)
  from entries e
  order by e.d, e.ord, e.c;
end;
$$;
revoke execute on function public.account_statement(uuid) from public, anon;
grant  execute on function public.account_statement(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Excel içe aktarma kayıtları (şablonlar netleşince işlenecek)
-- ---------------------------------------------------------------------
create table public.imports (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects (id) on delete cascade,
  kind         text not null,                      -- 'timesheet' | 'leave' | 'personnel' | 'invoice' | ...
  file_name    text not null,
  storage_path text,
  status       text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'failed')),
  total_rows   int,
  success_rows int,
  error_rows   int,
  errors       jsonb not null default '[]'::jsonb,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index imports_project_idx on public.imports (project_id, created_at desc);

alter table public.timesheets
  add constraint timesheets_import_fk foreign key (import_id) references public.imports (id) on delete set null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.timesheets     enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_records  enable row level security;
alter table public.invoices       enable row level security;
alter table public.payments       enable row level security;
alter table public.imports        enable row level security;

create policy timesheets_read on public.timesheets for select to authenticated
  using (app.has_project_permission(project_id, 'timesheets.read'));
create policy timesheets_write on public.timesheets for all to authenticated
  using (app.has_global_permission('timesheets.manage')) with check (app.has_global_permission('timesheets.manage'));

create policy leave_balances_read on public.leave_balances for select to authenticated
  using (app.can_access_personnel(personnel_id, 'leaves.read'));
create policy leave_balances_write on public.leave_balances for all to authenticated
  using (app.has_global_permission('leaves.manage')) with check (app.has_global_permission('leaves.manage'));

create policy leave_records_read on public.leave_records for select to authenticated
  using (app.can_access_personnel(personnel_id, 'leaves.read'));
create policy leave_records_write on public.leave_records for all to authenticated
  using (app.has_global_permission('leaves.manage')) with check (app.has_global_permission('leaves.manage'));

-- Customers never see draft invoices.
create policy invoices_read on public.invoices for select to authenticated
  using (
    app.has_global_permission('finance.manage')
    or (status = 'issued' and app.has_project_permission(project_id, 'invoices.read'))
  );
create policy invoices_write on public.invoices for all to authenticated
  using (app.has_global_permission('finance.manage')) with check (app.has_global_permission('finance.manage'));

create policy payments_read on public.payments for select to authenticated
  using (
    app.has_global_permission('finance.manage')
    or app.has_project_permission(project_id, 'payments.read')
  );
create policy payments_write on public.payments for all to authenticated
  using (app.has_global_permission('finance.manage')) with check (app.has_global_permission('finance.manage'));

create policy imports_all on public.imports for all to authenticated
  using (app.has_global_permission('imports.manage')) with check (app.has_global_permission('imports.manage'));
