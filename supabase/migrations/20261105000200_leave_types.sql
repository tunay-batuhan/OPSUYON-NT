-- İzin türleri: İş Kanunu Ek Madde 2'deki ücretli mazeret izinleri ayrı türler olarak eklenir.
-- Bu izinler yıllık izinden DÜŞÜLMEZ (md. 55); yalnızca 'yillik' türü bakiyeden düşer.
alter table public.leave_records drop constraint if exists leave_records_leave_type_check;
alter table public.leave_records add constraint leave_records_leave_type_check
  check (leave_type in ('yillik', 'ucretsiz', 'raporlu', 'mazeret', 'evlilik', 'babalik', 'dogum', 'olum', 'evlat_edinme', 'engelli_cocuk', 'diger'));
