-- =====================================================================
-- OPSUYON  |  10 · Müşteri çalışmasına göre (Faz 0)
--   · Modül anahtarları (müşteri panelinde hangi ekranlar açık)
--   · Teknik Personel hizmet alanı
--   · Yeni belge türleri + izinleri (kıyafet, savunma, denetim, risk, cari ekstre)
--   · Bordro: hizmet/proje bazlı toplu belge
--   · Personel → işveren firma (kendi bünyesinde çalışma modeli)
-- =====================================================================

-- ---------- hizmet alanı ----------
insert into public.service_lines (code, name, description, icon, sort_order) values
  ('teknik_personel', 'Teknik Personel', 'Teknik personel hizmetleri', 'wrench', 50)
on conflict (code) do nothing;

-- ---------- modül anahtarları ----------
create table public.app_modules (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name        text not null,
  description text,
  enabled     boolean not null default false,
  implemented boolean not null default true,     -- false = planlandı, henüz kodlanmadı
  sort_order  int not null default 100,
  updated_at  timestamptz not null default now()
);
create trigger app_modules_updated_at before update on public.app_modules
  for each row execute function app.set_updated_at();

alter table public.app_modules enable row level security;
create policy app_modules_read on public.app_modules for select to authenticated
  using (app.current_profile_active());
create policy app_modules_write on public.app_modules for update to authenticated
  using (app.has_global_permission('access.manage')) with check (app.has_global_permission('access.manage'));
create trigger audit_app_modules after update on public.app_modules
  for each row execute function app.audit_row();

insert into public.app_modules (code, name, description, enabled, implemented, sort_order) values
  -- müşterinin yazılı olarak istedikleri (açık)
  ('personel_sozlesme', 'Personel Sözleşmeleri',        'Hizmet filtresi + personel listesi + PDF indir',            true,  true, 10),
  ('personel_ozluk',    'Özlük Dosyaları',              'Sözleşmelerle aynı kalıp',                                  true,  true, 20),
  ('personel_bordro',   'Bordrolar',                    'Hizmet bazında toplu bordro PDF',                           true,  true, 30),
  ('personel_izin',     'Yıllık İzinler',               'Hak / kullanılan / kalan + personel izin formları',         true,  true, 40),
  ('personel_kiyafet',  'Kıyafet ve Ekipman',           'Teslim tutanakları (personel seçince)',                     true,  true, 50),
  ('personel_savunma',  'Personele Savunmalar',         'Savunma tutanakları (personel seçince)',                    true,  true, 60),
  ('puantaj',           'Puantaj',                      'Hizmet + ay + yıl filtresi, PDF puantaj + indir',           true,  true, 70),
  ('denetimler',        'Denetimler',                   'Tarih, gece/gündüz, denetim raporu PDF',                    true,  true, 80),
  ('cari_hesap',        'Cari Hesap',                   'Son yüklenen cari ekstre (PDF)',                            true,  true, 90),
  ('cari_faturalar',    'Faturalar (Cari Hesap altında)', 'Ay + yıl filtresi, fatura PDF',                        true,  true, 100),
  ('risk_analizi',      'Risk Analizi Raporu',          'Ana sayfada PDF',                                           true,  true, 110),
  -- "kaldırılacak" denenler (kapalı; istenirse açılır)
  ('projeler',          'Projeler',                     'Proje listesi ve proje sayfaları',                          false, true, 200),
  ('vardiya',           'Vardiya Planı',                'Aylık vardiya çizelgesi',                                   false, true, 210),
  ('izin_yonetimi',     'İzin Yönetimi (kayıt ekranı)', 'İzin kayıtları ve evrak yükleme ekranı',                    false, true, 220),
  ('raporlar',          'Raporlar',                     'Hazır raporlar ve Excel indirme',                           false, true, 230),
  ('mesajlar',          'Mesajlar (menü)',              'Merkez ile yazışma menüsü (ana sayfada son mesajlar görünür)', false, true, 240),
  -- ileride (kodlanmadı)
  ('devriye',           'Devriye Sistemi',              'Barkod okutma, günlük rapor, fotoğraf (Faz 3)',             false, false, 300),
  ('banka',             'Banka Entegrasyonu',           'Havale ile otomatik işlem (Faz 3)',                         false, false, 310);

-- ---------- yeni izinler ----------
insert into public.permissions (code, module, description, sort_order) values
  ('uniform.read',     'personel', 'Kıyafet ve ekipman tutanaklarını görüntüle', 42),
  ('defenses.read',    'personel', 'Savunma tutanaklarını görüntüle',            43),
  ('inspections.read', 'belgeler', 'Denetim raporlarını görüntüle',              52),
  ('risk.read',        'belgeler', 'Risk analizi raporunu görüntüle',            53)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from (values
  ('manager',          'uniform.read'), ('manager',          'defenses.read'), ('manager',          'inspections.read'), ('manager',          'risk.read'),
  ('operator',         'uniform.read'), ('operator',         'defenses.read'), ('operator',         'inspections.read'), ('operator',         'risk.read'),
  ('customer_manager', 'uniform.read'), ('customer_manager', 'defenses.read'), ('customer_manager', 'inspections.read'), ('customer_manager', 'risk.read'),
  ('customer_hr',      'uniform.read'), ('customer_hr',      'defenses.read')
) as p(role_code, code)
join public.roles r on r.code = p.role_code
on conflict do nothing;

-- ---------- belge türleri ----------
insert into public.document_categories (code, name, scope, permission_code, requires_period, sort_order) values
  ('kiyafet_ekipman', 'Kıyafet ve Ekipman Teslim Tutanağı', 'personnel', 'uniform.read',     false, 52),
  ('savunma',         'Personel Savunması',                 'personnel', 'defenses.read',    false, 54),
  ('denetim',         'Denetim Raporu',                     'project',   'inspections.read', true,  56),
  ('risk_analizi',    'Risk Analizi Raporu',                'project',   'risk.read',        false, 58),
  ('cari_ekstre',     'Cari Hesap Ekstresi (PDF)',          'project',   'ledger.read',      true,  66)
on conflict (code) do nothing;

-- bordro toplu: hizmet/proje bazlı (kişiye bağlı olmak zorunda değil)
update public.document_categories set scope = 'project', requires_period = true, name = 'Bordro (toplu)' where code = 'bordro';

-- ---------- personel → işveren firma ----------
alter table public.personnel add column organization_id uuid references public.organizations (id) on delete restrict;
create index personnel_organization_idx on public.personnel (organization_id);

update public.personnel p
   set organization_id = x.org
  from (
    select distinct on (a.personnel_id) a.personnel_id, pr.organization_id as org
      from public.personnel_assignments a
      join public.projects pr on pr.id = a.project_id
     order by a.personnel_id, a.start_date
  ) x
 where x.personnel_id = p.id and p.organization_id is null;

-- Personel müşteri firmanın kadrosundadır: yalnızca o firmanın projelerine atanabilir.
create or replace function app.validate_assignment_org()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_person_org uuid;
  v_project_org uuid;
begin
  select organization_id into v_person_org from public.personnel where id = new.personnel_id;
  select organization_id into v_project_org from public.projects where id = new.project_id;
  if v_person_org is null then
    update public.personnel set organization_id = v_project_org where id = new.personnel_id;
  elsif v_person_org is distinct from v_project_org then
    raise exception 'Bu personel başka bir firmanın kadrosunda; yalnızca kendi firmasının projelerine atanabilir.';
  end if;
  return new;
end;
$$;
create trigger personnel_assignments_validate_org before insert or update of personnel_id, project_id on public.personnel_assignments
  for each row execute function app.validate_assignment_org();
