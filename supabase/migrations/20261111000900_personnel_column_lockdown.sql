-- H1 (2. adım): personnel tablosunda yalnızca iş bilgisi sütunları okunabilir; kişisel sütunlar (telefon, e-posta,
-- doğum tarihi/yeri, memleket, adres, medeni hal, boy/kilo, beden ölçüleri, yakını, notlar) yalnızca
-- public.personnel_personal görünümünden ve "personelin kişisel bilgilerini gör" yetkisiyle okunur.
-- DİKKAT: Bu adım, kişisel bilgileri görünümden okuyan kod yayına girdikten SONRA uygulanır (20261111000800 notu).
-- Yazma hakları (insert/update) değişmez.
revoke select on public.personnel from authenticated, anon;
grant select (id, employee_no, first_name, last_name, full_name, title, service_line, hire_date, termination_date,
              status, organization_id, created_at, updated_at)
  on public.personnel to authenticated;
