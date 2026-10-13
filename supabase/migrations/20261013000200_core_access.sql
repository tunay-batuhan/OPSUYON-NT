-- =====================================================================
-- OPSUYON  |  02 · Organizations, projects, profiles, access control
--
-- Model
--   organization (müşteri firma)  1─n  project (hizmet hattına bağlı)
--   auth.users 1─1 profile (kind = 'staff' | 'customer')
--   staff    → profiles.staff_role_id  (global role, e.g. operator)
--   customer → project_members (per project role) + optional per-member
--              permission overrides (allow / deny) → "yetkiyi kısıtlayabilme"
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  legal_name  text,
  tax_office  text,
  tax_no      text,
  address     text,
  phone       text,
  email       text,
  status      text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  notes       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index organizations_tax_no_key on public.organizations (tax_no) where tax_no is not null;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function app.set_updated_at();

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  service_line    text not null references public.service_lines (code) on update cascade,
  code            text unique,
  name            text not null,
  address         text,
  status          text not null default 'active' check (status in ('active', 'paused', 'closed')),
  start_date      date,
  end_date        date,
  notes           text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index projects_org_idx  on public.projects (organization_id);
create index projects_line_idx on public.projects (service_line);
create trigger projects_updated_at before update on public.projects
  for each row execute function app.set_updated_at();

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        extensions.citext not null unique check (username::text ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  full_name       text not null,
  kind            text not null check (kind in ('staff', 'customer')),
  organization_id uuid references public.organizations (id) on delete restrict,
  staff_role_id   uuid references public.roles (id) on delete restrict,
  phone           text,
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_customer_has_org  check (kind <> 'customer' or organization_id is not null),
  constraint profiles_staff_has_role    check (kind <> 'staff'    or staff_role_id  is not null),
  constraint profiles_staff_no_org      check (kind <> 'staff'    or organization_id is null)
);
create index profiles_org_idx on public.profiles (organization_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

create table public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.member_permission_overrides (
  member_id       uuid not null references public.project_members (id) on delete cascade,
  permission_code text not null references public.permissions (code) on delete cascade on update cascade,
  is_allowed      boolean not null,
  primary key (member_id, permission_code)
);

-- Customer members must belong to the same organization as the project and use a customer role.
create or replace function app.validate_project_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
  v_user_org uuid;
  v_project_org uuid;
  v_scope text;
begin
  select kind, organization_id into v_kind, v_user_org from public.profiles where id = new.user_id;
  select organization_id into v_project_org from public.projects where id = new.project_id;
  select scope into v_scope from public.roles where id = new.role_id;

  if v_kind is distinct from 'customer' then
    raise exception 'Yalnızca müşteri kullanıcıları projeye üye olarak eklenebilir.';
  end if;
  if v_user_org is distinct from v_project_org then
    raise exception 'Kullanıcı ile proje aynı firmaya ait olmalı.';
  end if;
  if v_scope is distinct from 'customer' then
    raise exception 'Projeye üye için müşteri rolü seçilmeli.';
  end if;
  return new;
end;
$$;
create trigger project_members_validate before insert or update on public.project_members
  for each row execute function app.validate_project_member();

-- ---------------------------------------------------------------------
-- Permission functions (SECURITY DEFINER → bypass RLS, no recursion)
-- ---------------------------------------------------------------------
create or replace function app.current_profile_active()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false)
$$;

create or replace function app.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.kind = 'staff' and p.is_active
  )
$$;

create or replace function app.my_org_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organization_id from public.profiles
  where id = auth.uid() and kind = 'customer' and is_active
$$;

-- Global (merkez) permission: only active staff; super_admin implicitly has all.
create or replace function app.has_global_permission(perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.staff_role_id
    where p.id = auth.uid()
      and p.kind = 'staff'
      and p.is_active
      and (
        r.code = 'super_admin'
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_id = r.id and rp.permission_code = perm
        )
      )
  )
$$;

-- Project-scoped permission: staff via global permission; customers via
-- project membership (role grants, then per-member allow/deny override).
-- A suspended/archived organization or a closed project loses customer access.
create or replace function app.has_project_permission(pid uuid, perm text)
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
      where m.project_id = pid
        and m.user_id = auth.uid()
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

-- Effective permission list of the caller on one project (used by the UI to
-- decide which menu items to show; RLS remains the real gate).
create or replace function public.my_project_permissions(p_project_id uuid)
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(pm.code order by pm.code), '{}')
  from public.permissions pm
  where app.has_project_permission(p_project_id, pm.code)
$$;

create or replace function public.my_global_permissions()
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(pm.code order by pm.code), '{}')
  from public.permissions pm
  where app.has_global_permission(pm.code)
$$;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.service_lines              enable row level security;
alter table public.permissions                 enable row level security;
alter table public.roles                       enable row level security;
alter table public.role_permissions            enable row level security;
alter table public.organizations               enable row level security;
alter table public.projects                    enable row level security;
alter table public.profiles                    enable row level security;
alter table public.project_members             enable row level security;
alter table public.member_permission_overrides enable row level security;

-- Catalogs: readable by any signed-in, active user. Writes need access.manage.
create policy service_lines_read on public.service_lines for select to authenticated
  using (app.current_profile_active());
create policy service_lines_write on public.service_lines for all to authenticated
  using (app.has_global_permission('access.manage')) with check (app.has_global_permission('access.manage'));

create policy permissions_read on public.permissions for select to authenticated
  using (app.current_profile_active());
create policy permissions_write on public.permissions for all to authenticated
  using (app.has_global_permission('access.manage')) with check (app.has_global_permission('access.manage'));

create policy roles_read on public.roles for select to authenticated
  using (app.current_profile_active());
create policy roles_write on public.roles for all to authenticated
  using (app.has_global_permission('access.manage')) with check (app.has_global_permission('access.manage'));

create policy role_permissions_read on public.role_permissions for select to authenticated
  using (app.current_profile_active());
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (app.has_global_permission('access.manage')) with check (app.has_global_permission('access.manage'));

-- Organizations
create policy organizations_read on public.organizations for select to authenticated
  using (app.has_global_permission('organizations.read') or id = app.my_org_id());
create policy organizations_write on public.organizations for all to authenticated
  using (app.has_global_permission('organizations.manage')) with check (app.has_global_permission('organizations.manage'));

-- Projects
create policy projects_read on public.projects for select to authenticated
  using (app.has_project_permission(id, 'projects.read'));
create policy projects_write on public.projects for all to authenticated
  using (app.has_global_permission('projects.manage')) with check (app.has_global_permission('projects.manage'));

-- Profiles: everyone sees themselves; staff with users.read see all.
-- Writes happen through trusted server code (service role) or users.manage staff.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or app.has_global_permission('users.read'));
create policy profiles_write on public.profiles for all to authenticated
  using (app.has_global_permission('users.manage')) with check (app.has_global_permission('users.manage'));

-- Project membership & overrides
create policy project_members_read on public.project_members for select to authenticated
  using (user_id = auth.uid() or app.has_global_permission('users.read'));
create policy project_members_write on public.project_members for all to authenticated
  using (app.has_global_permission('users.manage')) with check (app.has_global_permission('users.manage'));

create policy member_overrides_read on public.member_permission_overrides for select to authenticated
  using (
    app.has_global_permission('users.read')
    or exists (select 1 from public.project_members m where m.id = member_id and m.user_id = auth.uid())
  );
create policy member_overrides_write on public.member_permission_overrides for all to authenticated
  using (app.has_global_permission('users.manage')) with check (app.has_global_permission('users.manage'));

-- ---------------------------------------------------------------------
-- Grants (RLS is the gate; functions are executable by signed-in users)
-- ---------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema app to authenticated, service_role;
grant execute on function public.my_project_permissions(uuid), public.my_global_permissions() to authenticated;
revoke execute on function public.my_project_permissions(uuid), public.my_global_permissions() from public, anon;
