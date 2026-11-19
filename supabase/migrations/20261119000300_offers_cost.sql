-- Teklif (19 Kasım): maliyet tablosu ve şirket kâr payı.
--   aylık net kâr = KDV farkı (KDV − OPSUYON teklifi) + şirket kâr payı × personel sayısı
-- İki ekran: "Teklif" (kişi başı bedel yazılır) ve "Maliyet karşılaştırma" (kişi başı bedel, maliyet tablosundan
-- hesaplanır: brüt maaş, SGK / işsizlik payları, yol, fazla mesai, giderler, kart, ek ödeme, şirket kâr payı).
-- Eski tekliflerde kâr payı %0 sayılır: tutarları değişmez.

alter table public.offers
  add column if not exists kind text not null default 'teklif' check (kind in ('teklif', 'maliyet')),
  add column if not exists profit_pct numeric(5,2) not null default 0 check (profit_pct between 0 and 100),
  add column if not exists profit_share_total numeric(14,2) not null default 0,
  add column if not exists vat_saving numeric(14,2) not null default 0,
  add column if not exists cost_params jsonb;
update public.offers set vat_saving = monthly_profit where vat_saving = 0 and profit_share_total = 0;
alter table public.offers alter column profit_pct set default 5;

alter table public.offer_lines
  add column if not exists unit_price numeric(14,2),
  add column if not exists profit_unit numeric(14,2) not null default 0,
  add column if not exists cost jsonb;
update public.offer_lines set unit_price = case when people > 0 then round(monthly_total / people, 2) else 0 end where unit_price is null;

alter table public.offer_settings
  add column if not exists profit_pct numeric(5,2) not null default 5 check (profit_pct between 0 and 100),
  add column if not exists cost_params jsonb;
