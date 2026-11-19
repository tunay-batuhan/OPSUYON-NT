-- Bordro şablonu (19 Kasım): maaş tablosunun sütunları ve formülleri değiştirilebilir.
--
-- Müşteri bordroyu Excel'de tutuyor; sütunlar ve formüller projeye / zamana göre değişiyor ve tek tek hücreler elle
-- düzeltiliyor. Bu yüzden hesap artık veritabanı tetikleyicisinde sabit değil:
--   payroll_templates  proje başına (project_id null = varsayılan) sütun listesi: kod, başlık, grup, tür (giriş / formül /
--                      metin), formül, ilk değer, toplam. Uygulama içindeki varsayılan şablon HELBA Excel düzenidir.
--   payroll_runs.template   dönem başlatılırken şablonun kopyası (taslakta "şablonu yenile" ile güncellenir)
--   payroll_lines.cells     satırda girilen değerler ve elle ezilen formül hücreleri  { kod: sayı | metin }
--   payroll_lines.calc      onay anında dondurulan sonuçlar { kod: sayı };  vars: o anki ücret tanımı / avans değerleri
-- Taslak dönemde tutarlar okunurken hesaplanır (güncel ücret tanımı ve avanslarla); onayda dondurulur.
-- Eski sayısal sütunlar (normal_pay, net_paid …) ve tetikleyici hesapları geçiş için durur; yeni ekranlar kullanmaz.

alter table public.pay_rates
  add column if not exists support_monthly numeric(12,2) not null default 0 check (support_monthly >= 0),   -- destek ödeme
  add column if not exists bes_monthly     numeric(12,2) not null default 0 check (bes_monthly >= 0);       -- BES kesintisi

alter table public.payroll_runs
  add column if not exists template jsonb;

alter table public.payroll_lines
  add column if not exists cells jsonb not null default '{}'::jsonb,
  add column if not exists calc  jsonb,
  add column if not exists vars  jsonb;

create table if not exists public.payroll_templates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid unique references public.projects (id) on delete cascade,   -- null = varsayılan şablon
  columns     jsonb not null check (jsonb_typeof(columns) = 'array'),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create unique index if not exists payroll_templates_default_idx on public.payroll_templates ((true)) where project_id is null;
drop trigger if exists payroll_templates_updated_at on public.payroll_templates;
create trigger payroll_templates_updated_at before update on public.payroll_templates
  for each row execute function app.set_updated_at();

alter table public.payroll_templates enable row level security;
drop policy if exists payroll_templates_read on public.payroll_templates;
create policy payroll_templates_read on public.payroll_templates for select to authenticated
  using (app.has_global_permission('payroll.manage') or app.has_global_permission('payroll.run') or app.has_global_permission('payroll.read'));
drop policy if exists payroll_templates_write on public.payroll_templates;
create policy payroll_templates_write on public.payroll_templates for all to authenticated
  using (app.has_global_permission('payroll.manage')) with check (app.has_global_permission('payroll.manage'));

drop trigger if exists audit_payroll_templates on public.payroll_templates;
create trigger audit_payroll_templates after insert or update or delete on public.payroll_templates
  for each row execute function app.audit_row();
