-- =====================================================================
-- OPSÜYON | İletişim talepleri (12 Kasım)
-- Herkese açık /iletisim formundan gelen mesajlar. YALNIZCA EKLEME: mevcut hiçbir nesne değişmez.
--
-- Erişim: RLS açık ve anon / authenticated için HİÇBİR politika yok; tablo yetkileri de geri alınır.
--   * Ekleme: sunucu kodu (service_role), form doğrulaması + gizli alan + süre + IP sınırı denetiminden sonra
--     (src/app/actions/contact.ts → submitContactMessage).
--   * Okuma / durum / silme: sunucu kodu (service_role), kişinin Süper Yönetici olduğu doğrulandıktan sonra
--     (/merkez/iletisim-talepleri).
-- IP adresi saklanmaz; yalnızca gizli anahtarla alınmış SHA-256 özeti (ip_hash) gönderim sınırı için tutulur.
-- Saklama: ip_hash 30 gün sonra silinir; mesajlar 12 ay sonra tamamen silinir (her gece, pg_cron; yoksa
-- gelen kutusu sayfası açılınca). Kişisel veri içerdiği için işlem geçmişine (audit_logs) bağlanmaz.
-- =====================================================================

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (char_length(full_name) between 2 and 100),
  company     text check (company is null or char_length(company) <= 120),
  email       text not null check (char_length(email) between 5 and 120),
  phone       text check (phone is null or char_length(phone) <= 20),
  topic       text not null check (topic in ('teklif', 'demo', 'destek', 'diger')),
  message     text not null check (char_length(message) between 10 and 3000),
  status      text not null default 'yeni' check (status in ('yeni', 'okundu', 'yanitlandi')),
  ip_hash     text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  handled_by  uuid references public.profiles(id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.contact_messages is
  'Web sitesi iletişim formu. Yalnızca service_role erişir (sunucu kodu). ip_hash 30 gün, mesaj 12 ay saklanır.';
comment on column public.contact_messages.ip_hash is
  'Gönderenin IP adresinin gizli anahtarlı SHA-256 özeti (ham IP saklanmaz); yalnızca gönderim sınırı için, 30 gün sonra silinir.';
comment on column public.contact_messages.status is 'yeni | okundu | yanitlandi';

create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index if not exists contact_messages_ip_idx on public.contact_messages (ip_hash, created_at) where ip_hash is not null;

drop trigger if exists contact_messages_updated_at on public.contact_messages;
create trigger contact_messages_updated_at before update on public.contact_messages
  for each row execute function app.set_updated_at();

alter table public.contact_messages enable row level security;
-- politika yok: anon ve authenticated hiçbir satırı göremez / yazamaz
revoke all on table public.contact_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.contact_messages to service_role;

-- ---------- saklama süresi ----------
create or replace function public.purge_old_contact_messages()
returns void
language sql security definer
set search_path = ''
as $$
  update public.contact_messages set ip_hash = null
   where ip_hash is not null and created_at < now() - interval '30 days';
  delete from public.contact_messages where created_at < now() - interval '12 months';
$$;
revoke execute on function public.purge_old_contact_messages() from public, anon, authenticated;
grant  execute on function public.purge_old_contact_messages() to service_role;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-old-contact-messages', '40 0 * * *', 'select public.purge_old_contact_messages()');
exception when others then
  raise notice 'pg_cron kurulamadı (%): uygulama tarafı yedeği kullanılacak', sqlerrm;
end $$;
