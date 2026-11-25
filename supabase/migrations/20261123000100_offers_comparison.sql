-- Teklif artık iki adım: 1) teklif (müşteri + hizmetler)  2) isteğe bağlı maliyet karşılaştırma.
-- with_comparison: karşılaştırma teklife eklenmiş mi. Var olan teklifler kazanç tablosuyla kaydedildiği için
-- sütunun varsayılanı true (eski kayıtlar aynı görünür); yeni kayıtlarda değeri uygulama açıkça yazar.
alter table public.offers add column if not exists with_comparison boolean not null default true;
comment on column public.offers.with_comparison is 'Maliyet karşılaştırma (kazanç kartları, Bugün / OPSUYON ile, maliyet dökümü) teklife eklenmiş mi; false = yalnızca teklif';
