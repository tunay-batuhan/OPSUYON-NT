-- Opsüyon AI: portalın tüm ekranlarını bilen yardım asistanı (yalnızca test aşaması için).
-- Müşteri modülleri sayfasından açılıp kapatılır; canlıya çıkarken kapatılması önerilir.
insert into public.app_modules (code, name, description, enabled, implemented, sort_order) values
  ('opsuyon_ai', 'Opsüyon AI (yardım asistanı)', 'Sağ altta açılan, portalın tüm ekranlarını ve işlevlerini bilen yardım asistanı. Yalnızca test aşaması için; canlıya çıkarken kapatın.', true, true, 400)
on conflict (code) do nothing;
