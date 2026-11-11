-- Resmi tatiller (11 Kasım): yıllık izin günü hesabında hafta tatili ve resmi tatiller izinden sayılmaz
-- (İş K. md. 56). Liste merkezce düzenlenir (İzin Yönetimi > Resmi tatiller); dini bayram tarihleri her yıl
-- değiştiği için koda gömülmez. Arife ve 28 Ekim öğleden sonra yarım gündür (half = true → 0,5 gün).
create table if not exists public.public_holidays (
  id         uuid primary key default gen_random_uuid(),
  day        date not null unique,
  name       text not null check (char_length(name) between 2 and 80),
  half       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.public_holidays enable row level security;

drop policy if exists public_holidays_read on public.public_holidays;
create policy public_holidays_read on public.public_holidays for select to authenticated using (true);

drop policy if exists public_holidays_write on public.public_holidays;
create policy public_holidays_write on public.public_holidays for all to authenticated
  using (app.has_global_permission('leaves.manage'))
  with check (app.has_global_permission('leaves.manage'));

revoke all on public.public_holidays from anon;
grant select, insert, update, delete on public.public_holidays to authenticated;

drop trigger if exists audit_public_holidays on public.public_holidays;
create trigger audit_public_holidays after insert or update or delete on public.public_holidays
  for each row execute function app.audit_row();

-- Sabit tarihli tatiller: 2025–2030
insert into public.public_holidays (day, name, half)
select make_date(y, m, d), n, h
  from generate_series(2025, 2030) as y,
       (values (1, 1, 'Yılbaşı', false),
               (4, 23, 'Ulusal Egemenlik ve Çocuk Bayramı', false),
               (5, 1, 'Emek ve Dayanışma Günü', false),
               (5, 19, 'Atatürk''ü Anma, Gençlik ve Spor Bayramı', false),
               (7, 15, 'Demokrasi ve Milli Birlik Günü', false),
               (8, 30, 'Zafer Bayramı', false),
               (10, 28, 'Cumhuriyet Bayramı arifesi (öğleden sonra)', true),
               (10, 29, 'Cumhuriyet Bayramı', false)) as f(m, d, n, h)
on conflict (day) do nothing;

-- Dini bayramlar (Diyanet takvimi): 2025–2027. Sonraki yıllar tarihler açıklanınca ekrandan eklenir.
insert into public.public_holidays (day, name, half) values
  ('2025-03-29', 'Ramazan Bayramı arifesi (öğleden sonra)', true),
  ('2025-03-30', 'Ramazan Bayramı 1. gün', false),
  ('2025-03-31', 'Ramazan Bayramı 2. gün', false),
  ('2025-04-01', 'Ramazan Bayramı 3. gün', false),
  ('2025-06-05', 'Kurban Bayramı arifesi (öğleden sonra)', true),
  ('2025-06-06', 'Kurban Bayramı 1. gün', false),
  ('2025-06-07', 'Kurban Bayramı 2. gün', false),
  ('2025-06-08', 'Kurban Bayramı 3. gün', false),
  ('2025-06-09', 'Kurban Bayramı 4. gün', false),
  ('2026-03-19', 'Ramazan Bayramı arifesi (öğleden sonra)', true),
  ('2026-03-20', 'Ramazan Bayramı 1. gün', false),
  ('2026-03-21', 'Ramazan Bayramı 2. gün', false),
  ('2026-03-22', 'Ramazan Bayramı 3. gün', false),
  ('2026-05-26', 'Kurban Bayramı arifesi (öğleden sonra)', true),
  ('2026-05-27', 'Kurban Bayramı 1. gün', false),
  ('2026-05-28', 'Kurban Bayramı 2. gün', false),
  ('2026-05-29', 'Kurban Bayramı 3. gün', false),
  ('2026-05-30', 'Kurban Bayramı 4. gün', false),
  ('2027-03-08', 'Ramazan Bayramı arifesi (öğleden sonra)', true),
  ('2027-03-09', 'Ramazan Bayramı 1. gün', false),
  ('2027-03-10', 'Ramazan Bayramı 2. gün', false),
  ('2027-03-11', 'Ramazan Bayramı 3. gün', false),
  ('2027-05-15', 'Kurban Bayramı arifesi (öğleden sonra)', true),
  ('2027-05-16', 'Kurban Bayramı 1. gün', false),
  ('2027-05-17', 'Kurban Bayramı 2. gün', false),
  ('2027-05-18', 'Kurban Bayramı 3. gün', false)
on conflict (day) do nothing;
-- 2027-05-19: Kurban Bayramı 4. günü, 19 Mayıs ile aynı güne denk gelir (sabit tatil olarak zaten var).
