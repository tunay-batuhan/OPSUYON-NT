-- Teklif modülü (16 Kasım). Yalnızca merkez (satış) kullanır; müşteri panelinde görünmez.
--
-- Satış görevlisi müşterinin yanında tabletten teklif hazırlar: müşterinin bugün satın aldığı hizmetler
-- (Güvenlik, Temizlik, Teknik Personel, Bahçıvan…; kişi sayısı ve aylık KDV hariç tutar) girilir.
--   aylık matrah     = hizmet tutarlarının toplamı (KDV hariç)
--   KDV              = matrah × KDV oranı
--   OPSÜYON teklifi  = toplam kişi × kişi başı teklif tutarı
--   aylık net kâr    = KDV − OPSÜYON teklifi
--   yıllık net kâr   = aylık net kâr × 12
-- Tutarları sunucu (lib/offer-calc.ts) hesaplar ve teklifle birlikte saklar; ekrandaki canlı hesap aynı fonksiyondur.

insert into public.permissions (code, module, description, sort_order, customer_grantable) values
  ('offers.read',   'teklif', 'Teklifleri ve teklif raporlarını görüntüle, PDF indir', 95, false),
  ('offers.manage', 'teklif', 'Teklif hazırla, düzenle, durumunu değiştir, sil',      96, false)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
  from (values ('manager', 'offers.read'), ('manager', 'offers.manage'), ('accountant', 'offers.read')) as p(role_code, code)
  join public.roles r on r.code = p.role_code
on conflict do nothing;

-- ---------- varsayılanlar (tek satır) ----------
create table public.offer_settings (
  id             boolean primary key default true check (id),
  fee_per_person numeric(12,2) not null default 7500 check (fee_per_person >= 0),
  vat_rate       numeric(5,2)  not null default 20 check (vat_rate between 0 and 100),
  validity_days  int           not null default 30 check (validity_days between 1 and 365),
  services       text[]        not null default array['Güvenlik', 'Temizlik', 'Teknik Personel', 'Bahçıvan'],
  updated_by     uuid references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now()
);
insert into public.offer_settings (id) values (true) on conflict do nothing;
create trigger offer_settings_updated_at before update on public.offer_settings
  for each row execute function app.set_updated_at();

-- ---------- teklifler ----------
create sequence if not exists public.offer_no_seq;

create table public.offers (
  id             uuid primary key default gen_random_uuid(),
  offer_no       text not null unique
                 default ('T-' || to_char(now() at time zone 'Europe/Istanbul', 'YYYY') || '-' || lpad(nextval('public.offer_no_seq')::text, 4, '0')),
  customer_name  text not null check (char_length(customer_name) between 2 and 160),
  contact_name   text check (char_length(contact_name) <= 120),
  phone          text check (char_length(phone) <= 40),
  email          text check (char_length(email) <= 160),
  address        text check (char_length(address) <= 400),
  notes          text check (char_length(notes) <= 2000),
  vat_rate       numeric(5,2)  not null check (vat_rate between 0 and 100),
  fee_per_person numeric(12,2) not null check (fee_per_person >= 0),
  valid_until    date,
  status         text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  decided_at     timestamptz,
  -- hesaplananlar (sunucu yazar)
  total_people   int           not null default 0,
  monthly_base   numeric(14,2) not null default 0,
  monthly_vat    numeric(14,2) not null default 0,
  offer_total    numeric(14,2) not null default 0,
  monthly_profit numeric(14,2) not null default 0,
  yearly_profit  numeric(14,2) not null default 0,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index offers_created_idx on public.offers (created_at desc);
create index offers_status_idx on public.offers (status);
create trigger offers_updated_at before update on public.offers
  for each row execute function app.set_updated_at();

create table public.offer_lines (
  id            uuid primary key default gen_random_uuid(),
  offer_id      uuid not null references public.offers (id) on delete cascade,
  service       text not null check (char_length(service) between 1 and 80),
  people        int not null check (people between 0 and 100000),
  monthly_total numeric(14,2) not null check (monthly_total >= 0),
  sort_order    int not null default 0
);
create index offer_lines_offer_idx on public.offer_lines (offer_id, sort_order);

create or replace function app.offers_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.decided_at := case when new.status in ('accepted', 'rejected') then now() end;
  end if;
  return new;
end;
$$;
create trigger offers_before before insert or update on public.offers
  for each row execute function app.offers_before();

alter table public.offer_settings enable row level security;
alter table public.offers         enable row level security;
alter table public.offer_lines    enable row level security;

create policy offer_settings_read on public.offer_settings for select to authenticated
  using (app.has_global_permission('offers.read') or app.has_global_permission('offers.manage'));
create policy offer_settings_write on public.offer_settings for update to authenticated
  using (app.has_global_permission('offers.manage')) with check (app.has_global_permission('offers.manage'));

create policy offers_read on public.offers for select to authenticated
  using (app.has_global_permission('offers.read') or app.has_global_permission('offers.manage'));
create policy offers_write on public.offers for all to authenticated
  using (app.has_global_permission('offers.manage')) with check (app.has_global_permission('offers.manage'));

create policy offer_lines_read on public.offer_lines for select to authenticated
  using (app.has_global_permission('offers.read') or app.has_global_permission('offers.manage'));
create policy offer_lines_write on public.offer_lines for all to authenticated
  using (app.has_global_permission('offers.manage')) with check (app.has_global_permission('offers.manage'));

create trigger audit_offers after insert or update or delete on public.offers
  for each row execute function app.audit_row();
