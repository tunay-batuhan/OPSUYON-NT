-- 16 Kasım (2): firma yetkilisi ve teklif anteti.
--
-- 1) Firmalara "Yetkili adı soyadı" (yeni firmada zorunlu; eski kayıtlarda boş kalabilir, düzenlerken istenir).
-- 2) Teklif PDF'i için merkezin yüklediği antetli kağıt (A4 PDF ya da görsel). Dosya 'documents' kovasında
--    offers/letterhead/ altında durur; içerik antetin üst ve alt boşluğu (mm) arasına yazılır.

alter table public.organizations
  add column if not exists contact_name text check (char_length(contact_name) <= 120);

alter table public.offer_settings
  add column if not exists letterhead_path      text check (letterhead_path like 'offers/letterhead/%'),
  add column if not exists letterhead_name      text check (char_length(letterhead_name) <= 255),
  add column if not exists letterhead_mime      text check (letterhead_mime in ('application/pdf', 'image/png', 'image/jpeg')),
  add column if not exists letterhead_top_mm    int not null default 45 check (letterhead_top_mm between 0 and 150),
  add column if not exists letterhead_bottom_mm int not null default 25 check (letterhead_bottom_mm between 0 and 100);
