-- 27 Kasım: müşteri talepleri.
--
-- 1) Firma (müşteri) logosu: personele basılan formların (yemek kartı teslim formu, belge süresi bildirimi) sol
--    üstünde personelin kadrosundaki firmanın logosu ve bilgileri yazar. Dosya 'documents' kovasında
--    organizations/logo/ altında durur; sunucu servis anahtarıyla okur/yazar.
-- 2) Personel kartı: yemek kartı numarası, sağlık raporu ve güvenlik kimlik kartı geçerlilik bitiş tarihleri.
--    Bitişe 6 ay kala merkez kullanıcılarına her gün uyarı çıkar (Bildirimler). Uyarı kapatılınca o gün için
--    gizlenir, ertesi gün yeniden çıkar (expiry_alert_dismissals).
--
-- Bu dosyayı yayından ÖNCE Supabase SQL Editor'de çalıştırın; tekrar çalıştırmak zararsızdır.

-- ---------- 1) firma logosu ----------
alter table public.organizations
  add column if not exists logo_path text check (logo_path like 'organizations/logo/%');

-- ---------- 2) personel kartı alanları ----------
alter table public.personnel
  add column if not exists meal_card_no        text check (char_length(meal_card_no) <= 40),
  add column if not exists health_report_until date,
  add column if not exists security_card_until date;

-- İş bilgisi sütunları gibi okunabilir (kişisel bilgi değil); bkz. 20261111000900_personnel_column_lockdown.sql
grant select (meal_card_no, health_report_until, security_card_until) on public.personnel to authenticated;

create index if not exists personnel_health_report_until_idx on public.personnel (health_report_until) where health_report_until is not null;
create index if not exists personnel_security_card_until_idx on public.personnel (security_card_until) where security_card_until is not null;

-- ---------- 3) süre uyarısını kapatma (kullanıcı başına, gün gün) ----------
create table if not exists public.expiry_alert_dismissals (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  kind         text not null check (kind in ('health_report', 'security_card')),
  dismissed_on date not null default (now() at time zone 'Europe/Istanbul')::date,
  printed      boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (user_id, personnel_id, kind)
);

alter table public.expiry_alert_dismissals enable row level security;

drop policy if exists expiry_alert_dismissals_own on public.expiry_alert_dismissals;
create policy expiry_alert_dismissals_own on public.expiry_alert_dismissals for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and app.is_staff());

grant select, insert, update, delete on public.expiry_alert_dismissals to authenticated;
