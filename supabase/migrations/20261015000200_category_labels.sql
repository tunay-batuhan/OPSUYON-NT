-- Belge türü adları: proje sekmeleriyle karışmasın.
--   "Puantaj" sekmesi  = gün/saat tablosu (elle giriş, Excel aktarım, vardiya planından)
--   Belge türü         = puantajın imzalı / taranmış dosyası
update public.document_categories set name = 'Puantaj Dosyası (imzalı / Excel)' where code = 'puantaj';
update public.document_categories set name = 'İzin Evrakları'                  where code = 'yillik_izin';
-- ödeme girişi kalktı; cari hesap Excel ekstreden geliyor
update public.document_categories set is_active = false                        where code = 'odeme';
