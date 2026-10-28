-- Müşteri notları (4. tur, "Demo Site Kullanıcısı" tablosu):
--  * Personel Sözleşmeleri sekmesi kalktı → sözleşmeler Özlük Evrakları altında
--  * Özlük Evrakları: sıralı evrak türleri (iş sözleşmesi, İSG, kimlik, ikametgah, adli sicil, sağlık raporu, onam formları)
--  * Eğitimler (yeni), Bordrolar (üst sekme), Savunmalar ve İhtarlar

-- ---------- yeni izin: eğitim belgeleri ----------
insert into public.permissions (code, module, description, sort_order) values
  ('trainings.read', 'personel', 'Personelin eğitim belgelerini görüntüle ve indir', 44)
on conflict (code) do nothing;

-- özlük evrakını görebilen herkes eğitim belgelerini de görür
insert into public.role_permissions (role_id, permission_code)
select rp.role_id, 'trainings.read' from public.role_permissions rp where rp.permission_code = 'personnel.files.read'
on conflict do nothing;

-- ---------- belge türleri ----------
update public.document_categories set name = 'Personel İş Sözleşmesi', sort_order = 20 where code = 'sozlesme';
update public.document_categories set name = 'Diğer Özlük Evrakları', sort_order = 31 where code = 'ozluk';

insert into public.document_categories (code, name, scope, permission_code, requires_period, sort_order) values
  ('isg_evraklari',            'İSG Evrakları',                                  'personnel', 'personnel.files.read', false, 21),
  ('nufus_kimlik',            'Nüfus Cüzdanı / Güvenlik Kimliği',               'personnel', 'personnel.files.read', false, 22),
  ('ikametgah',               'İkametgah',                                      'personnel', 'personnel.files.read', false, 23),
  ('adli_sicil',              'Adli Sicil Kaydı',                               'personnel', 'personnel.files.read', false, 24),
  ('saglik_raporu',           'Sağlık Raporu',                                  'personnel', 'personnel.files.read', false, 25),
  ('fazla_calisma_muvaffakat','Onam Formu: Fazla Çalışma Muvaffakatnamesi',     'personnel', 'personnel.files.read', false, 26),
  ('gece_calisma_muvaffakat', 'Onam Formu: Gece Çalışma Muvaffakatnamesi',      'personnel', 'personnel.files.read', false, 27),
  ('yillik_izin_muvaffakat',  'Onam Formu: Yıllık İzin Muvaffakatnamesi',       'personnel', 'personnel.files.read', false, 28),
  ('transfer_muvaffakat',     'Onam Formu: Transfer Muvaffakatnamesi',          'personnel', 'personnel.files.read', false, 29),
  ('ihtar',                   'Personel İhtarı',                                'personnel', 'defenses.read',        false, 55),
  ('egitim',                  'Eğitim Belgesi',                                 'personnel', 'trainings.read',       false, 57)
on conflict (code) do nothing;

-- ---------- modül anahtarları ----------
-- Personel Sözleşmeleri sekmesi kalktı (kod duruyor; kapalı)
update public.app_modules
   set enabled = false, sort_order = 205, name = 'Personel Sözleşmeleri (kalktı)',
       description = 'Kalktı: sözleşmeler artık Özlük Evrakları altında (1. sırada Personel İş Sözleşmesi)'
 where code = 'personel_sozlesme';
update public.app_modules
   set name = 'Özlük Evrakları',
       description = 'Personel seçilince sırayla: iş sözleşmesi, İSG, kimlik, ikametgah, adli sicil, sağlık raporu, onam formları; PDF indir + Görüntüle'
 where code = 'personel_ozluk';
update public.app_modules
   set description = 'Üst menüde ayrı sekme (Personel altında değil); hizmet + ay + yıl filtresi, bordro altta görüntülenir'
 where code = 'personel_bordro';
update public.app_modules
   set name = 'Savunmalar ve İhtarlar', description = 'Üst menüde ayrı sekme; savunma tutanakları ve ihtarlar (personel seçince)'
 where code = 'personel_savunma';
insert into public.app_modules (code, name, description, enabled, implemented, sort_order) values
  ('personel_egitim', 'Eğitimler', 'Üst menüde ayrı sekme: personel seçilince katıldığı eğitimler; PDF indir + Görüntüle', true, true, 25)
on conflict (code) do nothing;
