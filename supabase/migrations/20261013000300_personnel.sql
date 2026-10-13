-- =====================================================================
-- OPSUYON  |  03 · Personnel
--
-- Personnel are supplied by us (merkez) and ASSIGNED to customer projects.
-- Customers see a person only through an assignment on a project they can
-- access. Sensitive identifiers live in a separate table with its own
-- permission so they can be hidden independently.
-- =====================================================================

create table public.personnel (
  id               uuid primary key default gen_random_uuid(),
  employee_no      text unique,
  first_name       text not null,
  last_name        text not null,
  full_name        text generated always as (first_name || ' ' || last_name) stored,
  title            text,
  service_line     text references public.service_lines (code) on update cascade,
  phone            text,
  email            text,
  hire_date        date,
  termination_date date,
  status           text not null default 'active' check (status in ('active', 'passive', 'terminated')),
  notes            text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index personnel_status_idx on public.personnel (status);
create index personnel_name_idx   on public.personnel (full_name);
create trigger personnel_updated_at before update on public.personnel
  for each row execute function app.set_updated_at();

create table public.personnel_private (
  personnel_id      uuid primary key references public.personnel (id) on delete cascade,
  national_id       text,                    -- TC kimlik no
  birth_date        date,
  iban              text,
  address           text,
  emergency_contact jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);
create trigger personnel_private_updated_at before update on public.personnel_private
  for each row execute function app.set_updated_at();

create table public.personnel_assignments (
  id           uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  position     text,
  shift        text,
  start_date   date not null default current_date,
  end_date     date,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index personnel_assignments_personnel_idx on public.personnel_assignments (personnel_id);
create index personnel_assignments_project_idx   on public.personnel_assignments (project_id);

-- ---------------------------------------------------------------------
-- Access helper: may the caller act on this person with `perm`?
--   staff  → global permission
--   customer → permission on at least one project the person is/was assigned to
-- ---------------------------------------------------------------------
create or replace function app.can_access_personnel(pid uuid, perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    app.has_global_permission(perm)
    or exists (
      select 1 from public.personnel_assignments a
      where a.personnel_id = pid
        and app.has_project_permission(a.project_id, perm)
    )
$$;
grant execute on function app.can_access_personnel(uuid, text) to authenticated, service_role;

alter table public.personnel             enable row level security;
alter table public.personnel_private     enable row level security;
alter table public.personnel_assignments enable row level security;

create policy personnel_read on public.personnel for select to authenticated
  using (app.can_access_personnel(id, 'personnel.read'));
create policy personnel_write on public.personnel for all to authenticated
  using (app.has_global_permission('personnel.manage')) with check (app.has_global_permission('personnel.manage'));

create policy personnel_private_read on public.personnel_private for select to authenticated
  using (app.can_access_personnel(personnel_id, 'personnel.sensitive.read'));
create policy personnel_private_write on public.personnel_private for all to authenticated
  using (app.has_global_permission('personnel.manage')) with check (app.has_global_permission('personnel.manage'));

create policy assignments_read on public.personnel_assignments for select to authenticated
  using (app.has_project_permission(project_id, 'personnel.read'));
create policy assignments_write on public.personnel_assignments for all to authenticated
  using (app.has_global_permission('personnel.manage')) with check (app.has_global_permission('personnel.manage'));
