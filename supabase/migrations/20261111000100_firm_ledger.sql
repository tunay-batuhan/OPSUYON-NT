-- Cari Hesap (11 Kasım): proje değil FİRMA bazlı cari.
--  * Fatura girişi ve tahsilat girişi aynı tabloda (kind = 'fatura' | 'tahsilat'): tarih, saat, açıklama, tutar.
--  * Firmanın bakiyesi = tüm faturalar − tüm tahsilatlar (pozitif: firma borçlu).
--  * Okuma: merkez ledger.read (global); müşteri yalnızca KENDİ firmasının satırlarını ve yalnızca en az bir
--    projesinde ledger.read izni varsa görür. Yazma: merkez finance.manage.
--  * Eski proje bazlı tablolar (invoices, payments, ledger_statements, ledger_entries) silinmez.

create table public.firm_ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  kind            text not null check (kind in ('fatura', 'tahsilat')),
  entry_date      date not null,
  entry_time      time(0) without time zone not null default '00:00',
  description     text check (description is null or char_length(description) <= 500),
  amount          numeric(14,2) not null check (amount > 0),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- firmanın hareketleri (en yeni üstte) ve tarih aralığı süzgeci
create index firm_ledger_entries_org_idx  on public.firm_ledger_entries (organization_id, entry_date desc, entry_time desc, created_at desc);
create index firm_ledger_entries_date_idx on public.firm_ledger_entries (entry_date);

alter table public.firm_ledger_entries enable row level security;

create policy firm_ledger_entries_read on public.firm_ledger_entries for select to authenticated
  using (
    app.has_global_permission('ledger.read')
    or (organization_id = app.my_org_id() and app.has_any_permission('ledger.read'))
  );
create policy firm_ledger_entries_write on public.firm_ledger_entries for all to authenticated
  using (app.has_global_permission('finance.manage')) with check (app.has_global_permission('finance.manage'));

revoke all on public.firm_ledger_entries from anon;

create trigger audit_firm_ledger_entries after insert or update or delete on public.firm_ledger_entries
  for each row execute function app.audit_row();

-- Firma başına toplamlar (security_invoker: okuyan kullanıcının RLS'i geçerli; müşteri yalnızca kendi firmasını görür).
create view public.firm_ledger_balances with (security_invoker = true) as
select
  e.organization_id,
  o.name                                                                        as organization_name,
  coalesce(sum(e.amount) filter (where e.kind = 'fatura'), 0)::numeric(14,2)    as total_invoiced,
  coalesce(sum(e.amount) filter (where e.kind = 'tahsilat'), 0)::numeric(14,2)  as total_collected,
  coalesce(sum(case when e.kind = 'fatura' then e.amount else -e.amount end), 0)::numeric(14,2) as balance,
  count(*)::int                                                                 as entry_count,
  max(e.entry_date)                                                             as last_entry_date,
  min(e.entry_date)                                                             as first_entry_date
from public.firm_ledger_entries e
left join public.organizations o on o.id = e.organization_id
group by e.organization_id, o.name;

-- Hareketler + yürüyen bakiye (o hareketten sonraki firma bakiyesi). Pencere firma bazında hesaplanır;
-- firma süzgeci bölüm anahtarı olduğu için alta iner, tür / tarih süzgeçleri yürüyen bakiyeyi değiştirmez.
create view public.firm_ledger_movements with (security_invoker = true) as
select
  e.id,
  e.organization_id,
  e.kind,
  e.entry_date,
  e.entry_time,
  e.description,
  e.amount,
  e.created_by,
  e.created_at,
  sum(case when e.kind = 'fatura' then e.amount else -e.amount end)
    over (partition by e.organization_id order by e.entry_date, e.entry_time, e.created_at, e.id
          rows between unbounded preceding and current row)::numeric(14,2) as running_balance
from public.firm_ledger_entries e;

revoke all on public.firm_ledger_balances, public.firm_ledger_movements from anon, authenticated;
grant select on public.firm_ledger_balances, public.firm_ledger_movements to authenticated;
