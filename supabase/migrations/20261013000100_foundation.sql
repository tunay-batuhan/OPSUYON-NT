-- =====================================================================
-- OPSUYON  |  01 · Foundation
-- Extensions, helper schema, reference catalogs and the RBAC model.
--
-- Extensibility notes
--  * Service lines (Güvenlik / Temizlik / Kurumsal Tedarik) are DATA, not enums.
--    A new line = one INSERT into public.service_lines.
--  * Permissions are a catalog. A new module = INSERT permissions + attach them
--    to roles. No schema change needed to gate a new feature.
--  * Every business table carries a `metadata jsonb` column for ad-hoc fields.
-- =====================================================================

create extension if not exists citext with schema extensions;

create schema if not exists app;
comment on schema app is 'Internal helpers (auth/permission functions). Not exposed through the Data API.';
grant usage on schema app to authenticated, service_role;

-- Lock the Data API down for anonymous visitors. Everything requires a login.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema app    grant execute on functions to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Generic trigger helpers
-- ---------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Service lines (the three login buttons today; more tomorrow)
-- ---------------------------------------------------------------------
create table public.service_lines (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name        text not null,
  description text,
  icon        text,                       -- lucide icon name used by the UI
  sort_order  int  not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.service_lines (code, name, description, icon, sort_order) values
  ('guvenlik',         'Güvenlik',          'Özel güvenlik personeli ve operasyon yönetimi', 'shield-check', 10),
  ('temizlik',         'Temizlik',          'Temizlik personeli ve operasyon yönetimi',      'sparkles',     20),
  ('kurumsal_tedarik', 'Kurumsal Tedarik',  'Kurumsal personel tedariği ve süreç takibi',    'briefcase',    30);

-- ---------------------------------------------------------------------
-- RBAC: permissions catalog, roles, role→permission grants
-- ---------------------------------------------------------------------
create table public.permissions (
  code        text primary key check (code ~ '^[a-z_]+(\.[a-z_]+)+$'),
  module      text not null,
  description text not null,
  sort_order  int  not null default 100
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name        text not null,
  scope       text not null check (scope in ('staff', 'customer')),
  description text,
  is_system   boolean not null default false,   -- system roles cannot be deleted from the UI
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger roles_updated_at before update on public.roles
  for each row execute function app.set_updated_at();

create table public.role_permissions (
  role_id         uuid not null references public.roles (id) on delete cascade,
  permission_code text not null references public.permissions (code) on delete cascade on update cascade,
  primary key (role_id, permission_code)
);
create index role_permissions_permission_idx on public.role_permissions (permission_code);

-- ---------- permission catalog ----------
insert into public.permissions (code, module, description, sort_order) values
  -- yönetim (merkez)
  ('organizations.read',      'yonetim',   'Firmaları görüntüle',                       10),
  ('organizations.manage',    'yonetim',   'Firma oluştur / düzenle / askıya al',       11),
  ('users.read',              'yonetim',   'Kullanıcıları görüntüle',                   12),
  ('users.manage',            'yonetim',   'Kullanıcı oluştur / yetkilendir / kısıtla', 13),
  ('access.manage',           'yonetim',   'Rol ve izin tanımlarını yönet',             14),
  ('audit.read',              'yonetim',   'İşlem geçmişini görüntüle',                 15),
  ('imports.manage',          'yonetim',   'Excel içe aktarma işlemleri',               16),
  -- projeler
  ('projects.read',           'projeler',  'Proje bilgilerini görüntüle',               20),
  ('projects.manage',         'projeler',  'Proje oluştur / düzenle',                   21),
  -- personel
  ('personnel.read',          'personel',  'Proje personel listesini görüntüle',        30),
  ('personnel.manage',        'personel',  'Personel kayıtlarını yönet',                31),
  ('personnel.sensitive.read','personel',  'TC kimlik, IBAN gibi hassas bilgileri gör', 32),
  ('personnel.files.read',    'personel',  'Özlük evraklarını görüntüle / indir',       33),
  ('contracts.read',          'personel',  'Personel sözleşmelerini görüntüle / indir', 34),
  ('payroll.read',            'personel',  'Bordroları görüntüle / indir',              35),
  ('timesheets.read',         'personel',  'Puantajları görüntüle / indir',             36),
  ('timesheets.manage',       'personel',  'Puantaj kayıtlarını yönet',                 37),
  ('leaves.read',             'personel',  'Yıllık izin durumlarını görüntüle',         38),
  ('leaves.manage',           'personel',  'İzin kayıtlarını yönet',                    39),
  -- belgeler
  ('documents.read',          'belgeler',  'Genel belgeleri görüntüle / indir',         50),
  ('documents.manage',        'belgeler',  'Belge yükle / sil / görünürlüğünü ayarla',  51),
  -- finans
  ('invoices.read',           'finans',    'Aylık faturaları görüntüle / indir',        60),
  ('payments.read',           'finans',    'Ödemeleri görüntüle',                       61),
  ('ledger.read',             'finans',    'Cari hesap ekstresini görüntüle',           62),
  ('finance.manage',          'finans',    'Fatura / ödeme kayıtlarını yönet',          63),
  -- iletişim
  ('messages.use',            'iletisim',  'Merkez ile yazış',                          70),
  ('messages.manage',         'iletisim',  'Tüm yazışmaları yönet (merkez)',            71);

-- ---------- system roles ----------
insert into public.roles (code, name, scope, description, is_system) values
  ('super_admin',       'Süper Yönetici',      'staff',    'Tüm yetkilere sahip; kontrolleri atlar.',              true),
  ('manager',           'Merkez Yöneticisi',   'staff',    'Operasyonun tamamını yönetir; rol tanımı hariç.',      true),
  ('operator',          'Operasyon Uzmanı',    'staff',    'Personel, puantaj, belge ve yazışmaları yönetir.',     true),
  ('accountant',        'Muhasebe',            'staff',    'Fatura, ödeme ve cari hesapları yönetir.',             true),
  ('customer_manager',  'Firma Yöneticisi',    'customer', 'Firmanın projelerindeki tüm izinli bilgileri görür.',  true),
  ('customer_hr',       'Firma İK',            'customer', 'Personel, puantaj, izin, bordro ve evrak görür.',      true),
  ('customer_finance',  'Firma Muhasebe',      'customer', 'Fatura, ödeme ve cari hesap görür.',                   true),
  ('customer_viewer',   'Firma Görüntüleyici', 'customer', 'Temel proje ve personel bilgilerini görür.',           true);

-- manager: everything except access.manage
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r cross join public.permissions p
where r.code = 'manager' and p.code <> 'access.manage';

-- operator
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r join public.permissions p on p.code in (
  'organizations.read','users.read','projects.read','personnel.read','personnel.manage',
  'personnel.sensitive.read','personnel.files.read','contracts.read','timesheets.read','timesheets.manage',
  'leaves.read','leaves.manage','documents.read','documents.manage','imports.manage',
  'messages.use','messages.manage')
where r.code = 'operator';

-- accountant
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r join public.permissions p on p.code in (
  'organizations.read','projects.read','invoices.read','payments.read','ledger.read',
  'finance.manage','documents.read','documents.manage','messages.use')
where r.code = 'accountant';

-- customer_manager
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r join public.permissions p on p.code in (
  'projects.read','personnel.read','personnel.files.read','contracts.read','payroll.read',
  'timesheets.read','leaves.read','documents.read','invoices.read','payments.read','ledger.read',
  'messages.use')
where r.code = 'customer_manager';

-- customer_hr
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r join public.permissions p on p.code in (
  'projects.read','personnel.read','personnel.files.read','contracts.read','payroll.read',
  'timesheets.read','leaves.read','documents.read','messages.use')
where r.code = 'customer_hr';

-- customer_finance
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r join public.permissions p on p.code in (
  'projects.read','invoices.read','payments.read','ledger.read','documents.read','messages.use')
where r.code = 'customer_finance';

-- customer_viewer
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r join public.permissions p on p.code in (
  'projects.read','personnel.read','timesheets.read','leaves.read','messages.use')
where r.code = 'customer_viewer';
