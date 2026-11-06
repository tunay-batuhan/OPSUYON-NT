-- Müşteri notları (5. tur, 5 Kasım): hizmet alanları, personel kartı alanları, vardiya kaldırıldı.

-- ---------- hizmet alanları ----------
-- "Danışma ve Tesis Yönetimi birbirinden ayrılacak": mevcut hat Danışma olur, Tesis Yönetimi ayrı hat olarak eklenir.
update public.service_lines
   set name = 'Danışma', description = 'Danışma ve resepsiyon personeli yönetimi', icon = 'concierge-bell'
 where code = 'danisma_tesis';
insert into public.service_lines (code, name, description, icon, sort_order) values
  ('tesis_yonetimi', 'Tesis Yönetimi', 'Tesis ve bina yönetimi hizmetleri', 'building-2', 45)
on conflict (code) do nothing;
-- "Kurumsal Tedarik kalkacak": yeni proje açılamaz, mevcut projeler durur.
update public.service_lines set is_active = false where code = 'kurumsal_tedarik';

-- ---------- personel kartı: yeni alanlar (müşterinin listesi) ----------
alter table public.personnel
  add column if not exists birth_date      date,
  add column if not exists birth_place     text,
  add column if not exists hometown        text,
  add column if not exists address         text,
  add column if not exists marital_status  text check (marital_status is null or marital_status in ('bekar', 'evli')),
  add column if not exists height_cm       smallint check (height_cm is null or height_cm between 100 and 250),
  add column if not exists weight_kg       smallint check (weight_kg is null or weight_kg between 30 and 250),
  add column if not exists pants_size      text,
  add column if not exists shirt_size      text,
  add column if not exists coat_size       text,
  add column if not exists shoe_size       text,
  add column if not exists emergency_phone text,
  add column if not exists emergency_contact_name text;

-- önceden personnel_private'ta tutulan doğum tarihi / adres personel kartına taşınır (TC ve IBAN özel tabloda kalır)
update public.personnel p
   set birth_date = coalesce(p.birth_date, pr.birth_date),
       address    = coalesce(p.address, pr.address)
  from public.personnel_private pr
 where pr.personnel_id = p.id;

-- ---------- modül anahtarları ----------
update public.app_modules
   set name = 'Vardiya Planı (kaldırıldı)', enabled = false,
       description = 'Müşteri isteğiyle kaldırıldı; kod duruyor, menüde yok'
 where code = 'vardiya';
