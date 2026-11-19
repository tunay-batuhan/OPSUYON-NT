-- Teklif numarası "T-" yerine "OPS-" ile başlar (müşteri isteği, 19 Kasım). Var olan numaralar da çevrilir.
alter table public.offers
  alter column offer_no set default ('OPS-' || to_char(now() at time zone 'Europe/Istanbul', 'YYYY') || '-' || lpad(nextval('public.offer_no_seq')::text, 4, '0'));

update public.offers set offer_no = 'OPS-' || substring(offer_no from 3) where offer_no like 'T-%';
