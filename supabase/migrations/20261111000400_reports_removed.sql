-- Raporlar ekranı kaldırıldı (11 Kasım): içindeki listeler diğer ekranlardan görülebiliyor.
-- Modül satırı silinir; Müşteri modülleri ekranında artık görünmez.
delete from public.app_modules where code = 'raporlar';
