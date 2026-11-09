-- Devriye Sistemi artık demo değil (9 Kasım): Müşteri modülleri ekranındaki açıklamadan "DEMO" ibaresi kalkar.
update public.app_modules
   set description = 'QR + proje PIN''i ile okutma, proje bazlı noktalar ve etiketler, okutma kayıtları (1 ay, tarih aralığı), günlük rapor (PDF)'
 where code = 'devriye';
