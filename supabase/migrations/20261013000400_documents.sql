-- =====================================================================
-- OPSUYON  |  04 · Documents & storage
--
-- One generic documents table covers özlük evrakı, sözleşme, bordro,
-- puantaj dosyası, fatura PDF, ödeme dekontu ... Each category names the
-- permission needed to read it, so a new document kind is just a new row
-- in document_categories (no schema change).
-- =====================================================================

create table public.document_categories (
  code            text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name            text not null,
  scope           text not null check (scope in ('personnel', 'project')),
  permission_code text not null references public.permissions (code) on update cascade,
  requires_period boolean not null default false,   -- aylık belge (bordro, fatura, puantaj...)
  sort_order      int not null default 100,
  is_active       boolean not null default true
);

insert into public.document_categories (code, name, scope, permission_code, requires_period, sort_order) values
  ('ozluk',       'Özlük Evrakı',   'personnel', 'personnel.files.read', false, 10),
  ('sozlesme',    'Sözleşme',       'personnel', 'contracts.read',       false, 20),
  ('bordro',      'Bordro',         'personnel', 'payroll.read',         true,  30),
  ('puantaj',     'Puantaj',        'project',   'timesheets.read',      true,  40),
  ('yillik_izin', 'Yıllık İzin',    'personnel', 'leaves.read',          false, 50),
  ('fatura',      'Fatura',         'project',   'invoices.read',        true,  60),
  ('odeme',       'Ödeme / Dekont', 'project',   'payments.read',        false, 70),
  ('diger',       'Diğer',          'project',   'documents.read',       false, 99);

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  personnel_id     uuid references public.personnel (id) on delete set null,
  category_code    text not null references public.document_categories (code) on update cascade,
  title            text not null,
  description      text,
  storage_bucket   text not null default 'documents',
  storage_path     text not null unique,
  file_name        text not null,
  mime_type        text,
  size_bytes       bigint check (size_bytes is null or size_bytes >= 0),
  period_year      smallint check (period_year between 2000 and 2100),
  period_month     smallint check (period_month between 1 and 12),
  customer_visible boolean not null default false,   -- merkez "yayınla" demedikçe müşteri görmez
  uploaded_by      uuid references public.profiles (id) on delete set null,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index documents_project_cat_idx on public.documents (project_id, category_code, period_year desc, period_month desc);
create index documents_personnel_idx   on public.documents (personnel_id) where personnel_id is not null;
create trigger documents_updated_at before update on public.documents
  for each row execute function app.set_updated_at();

create or replace function app.category_permission(cat text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select permission_code from public.document_categories where code = cat
$$;

create or replace function app.can_read_document(doc public.documents)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    app.has_global_permission('documents.manage')
    or (
      doc.customer_visible
      and app.has_project_permission(doc.project_id, app.category_permission(doc.category_code))
      and (
        doc.personnel_id is null
        or exists (
          select 1 from public.personnel_assignments a
          where a.personnel_id = doc.personnel_id and a.project_id = doc.project_id
        )
      )
    )
$$;

grant execute on function app.category_permission(text), app.can_read_document(public.documents)
  to authenticated, service_role;

alter table public.document_categories enable row level security;
alter table public.documents           enable row level security;

create policy document_categories_read on public.document_categories for select to authenticated
  using (app.current_profile_active());
create policy document_categories_write on public.document_categories for all to authenticated
  using (app.has_global_permission('access.manage')) with check (app.has_global_permission('access.manage'));

create policy documents_read on public.documents for select to authenticated
  using (app.can_read_document(documents));
create policy documents_write on public.documents for all to authenticated
  using (app.has_global_permission('documents.manage')) with check (app.has_global_permission('documents.manage'));

-- ---------------------------------------------------------------------
-- Storage: one private bucket. Uploads happen server-side (service role);
-- signed URLs are only issued after the documents row passed RLS.
-- The policy below is defense in depth for direct client access.
-- Path convention: {project_id}/{category}/{uuid}-{filename}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)       -- 50 MB
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy documents_storage_read on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name and app.can_read_document(d)
    )
  );
