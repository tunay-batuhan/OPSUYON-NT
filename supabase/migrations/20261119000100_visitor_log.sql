-- Ziyaretçi Takip (19 Kasım). Site güvenliğinin deftere yazdığı ziyaretçi ve kargo kayıtlarının dijital hâli.
--
-- Güvenlik görevlisi (personel hesabı, projesi Güvenlik / Danışma) telefondan ya da kulübedeki tabletten tek ekranda:
--   ziyaretçi: ad soyad, telefon, plaka, nereye (daire / firma), sakinin onayı (onaylandı / reddedildi / bekliyor),
--              giriş saati; çıkışta "Çıkış yaptı"
--   kargo:     kargo firması, kime (daire / firma), paket sayısı, kurye; kulübede bekler, "Teslim et" ile teslim alan yazılır
-- Müşteri (site yönetimi) ve merkez kayıtları süzer, günlük raporu PDF alır; "visitors.record" yetkisiyle panelden de girer.
-- Personel hesabı tabloları RLS ile okuyamaz; sunucu, personelin o projede aktif görevli olduğunu denetleyip yazar.

insert into public.permissions (code, module, description, sort_order, customer_grantable) values
  ('visitors.read',   'ziyaretci', 'Ziyaretçi ve kargo kayıtlarını görüntüle, günlük rapor (PDF) indir', 100, true),
  ('visitors.record', 'ziyaretci', 'Ziyaretçi / kargo kaydı gir, çıkış ve teslim işaretle, kaydı sil',    101, true)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
  from (values
    ('manager', 'visitors.read'), ('manager', 'visitors.record'),
    ('operator', 'visitors.read'), ('operator', 'visitors.record'),
    ('customer_manager', 'visitors.read'), ('customer_manager', 'visitors.record'),
    ('customer_hr', 'visitors.read'),
    ('customer_viewer', 'visitors.read')
  ) as p(role_code, code)
  join public.roles r on r.code = p.role_code
on conflict do nothing;

insert into public.app_modules (code, name, description, enabled, implemented, sort_order) values
  ('ziyaretci', 'Ziyaretçi Takip', 'Ziyaretçi ve kargo defteri: giriş-çıkış, plaka, sakin onayı, teslimat, günlük rapor', true, true, 118)
on conflict (code) do nothing;

create table public.visitor_logs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete restrict,
  kind          text not null check (kind in ('ziyaretci', 'kargo')),
  full_name     text check (char_length(full_name) <= 120),          -- ziyaretçi adı soyadı / kargoda kurye (isteğe bağlı)
  phone         text check (char_length(phone) <= 30),
  plate         text check (char_length(plate) <= 15),               -- büyük harf, boşluksuz (34ABC123)
  destination   text not null check (char_length(destination) between 1 and 120),   -- daire / firma
  approval      text check (approval in ('onaylandi', 'reddedildi', 'bekliyor')),
  courier       text check (char_length(courier) <= 60),             -- kargo firması
  package_count smallint not null default 1 check (package_count between 1 and 99),
  note          text check (char_length(note) <= 500),
  entered_at    timestamptz not null default now(),
  exited_at     timestamptz,                                         -- ziyaretçi çıkışı
  delivered_at  timestamptz,                                         -- kargo teslimi
  delivered_to  text check (char_length(delivered_to) <= 120),
  personnel_id  uuid references public.personnel (id) on delete set null,   -- kaydeden güvenlik görevlisi
  created_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  constraint visitor_logs_kind_fields check (
    (kind = 'ziyaretci' and full_name is not null and char_length(full_name) >= 2 and approval is not null)
    or (kind = 'kargo' and courier is not null)
  )
);
create index visitor_logs_project_time_idx on public.visitor_logs (project_id, entered_at desc);
create index visitor_logs_open_idx on public.visitor_logs (project_id) where exited_at is null and delivered_at is null;
create trigger visitor_logs_updated_at before update on public.visitor_logs
  for each row execute function app.set_updated_at();

alter table public.visitor_logs enable row level security;
create policy visitor_logs_read on public.visitor_logs for select to authenticated
  using (app.has_project_permission(project_id, 'visitors.read'));
create policy visitor_logs_insert on public.visitor_logs for insert to authenticated
  with check (app.has_project_permission(project_id, 'visitors.record'));
create policy visitor_logs_update on public.visitor_logs for update to authenticated
  using (app.has_project_permission(project_id, 'visitors.record'))
  with check (app.has_project_permission(project_id, 'visitors.record'));
create policy visitor_logs_delete on public.visitor_logs for delete to authenticated
  using (app.has_project_permission(project_id, 'visitors.record'));

create trigger audit_visitor_logs after insert or update or delete on public.visitor_logs
  for each row execute function app.audit_row();
