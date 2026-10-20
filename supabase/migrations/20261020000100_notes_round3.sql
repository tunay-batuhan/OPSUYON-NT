-- Müşteri notları (19 Ekim, 3. tur): Formlar ekranı, Savunmalar adı, Risk Analizi menüsü, Yaklaşan Sözleşme kutusu.

-- ---------- yeni izin: form şablonlarını görüntüle ----------
insert into public.permissions (code, module, description, sort_order) values
  ('forms.read', 'belgeler', 'Form şablonlarını görüntüle ve indir', 54)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from (values
  ('manager',          'forms.read'),
  ('operator',         'forms.read'),
  ('customer_manager', 'forms.read'),
  ('customer_hr',      'forms.read')
) as p(role_code, code)
join public.roles r on r.code = p.role_code
on conflict do nothing;

-- Projeye bağlı olmayan ekranlar için: kişi herhangi bir projesinde bu izne sahip mi?
create or replace function app.has_any_permission(perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    app.has_global_permission(perm)
    or exists (
      select 1
      from public.project_members m
      join public.profiles p      on p.id = m.user_id and p.is_active and p.kind = 'customer'
      join public.projects pr     on pr.id = m.project_id
      join public.organizations o on o.id = pr.organization_id and o.status = 'active'
      where m.user_id = auth.uid()
        and pr.status <> 'closed'
        and coalesce(
              (select ov.is_allowed
                 from public.member_permission_overrides ov
                where ov.member_id = m.id and ov.permission_code = perm),
              exists (select 1 from public.role_permissions rp
                       where rp.role_id = m.role_id and rp.permission_code = perm)
            )
    )
$$;
grant execute on function app.has_any_permission(text) to authenticated, service_role;

-- ---------- form şablonları (tüm müşteriler için ortak, merkez yükler) ----------
create table public.form_templates (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 2 and 140),
  description    text,
  storage_bucket text not null default 'documents',
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text,
  size_bytes     bigint check (size_bytes is null or size_bytes >= 0),
  sort_order     int not null default 100,
  is_active      boolean not null default true,
  uploaded_by    uuid references public.profiles (id) on delete set null,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger form_templates_updated_at before update on public.form_templates
  for each row execute function app.set_updated_at();
create trigger audit_form_templates after insert or update or delete on public.form_templates
  for each row execute function app.audit_row();

alter table public.form_templates enable row level security;
create policy form_templates_read on public.form_templates for select to authenticated
  using ((is_active and app.has_any_permission('forms.read')) or app.has_global_permission('documents.manage'));
create policy form_templates_write on public.form_templates for all to authenticated
  using (app.has_global_permission('documents.manage')) with check (app.has_global_permission('documents.manage'));

-- ---------- modül anahtarları ----------
insert into public.app_modules (code, name, description, enabled, implemented, sort_order) values
  ('formlar',           'Formlar',                         'Form şablonları (izin talep, kıyafet teslim, savunma…); birkaç harfle arama, indirme', true,  true, 45),
  ('yaklasan_sozlesme', 'Yaklaşan Sözleşme (ana sayfa)',   'Müşteri ana sayfasındaki "Yaklaşan Sözleşme" kutusu ve bildirimi',                     false, true, 250)
on conflict (code) do nothing;

update public.app_modules set name = 'Savunmalar', description = 'Savunma tutanakları (personel seçince)' where code = 'personel_savunma';
update public.app_modules set description = 'Menüde "Risk Analizi": merkezin yüklediği rapor satır satır listelenir, PDF indirilir', sort_order = 105 where code = 'risk_analizi';
