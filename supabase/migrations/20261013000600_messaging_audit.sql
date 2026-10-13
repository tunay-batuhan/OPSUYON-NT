-- =====================================================================
-- OPSUYON  |  06 · Messaging with the center, audit trail
-- =====================================================================

create table public.threads (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  subject         text not null,
  status          text not null default 'open' check (status in ('open', 'closed')),
  created_by      uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index threads_project_idx on public.threads (project_id, last_message_at desc);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete restrict,
  sender_name text not null default '',                 -- denormalised: customers cannot read other profiles
  sender_kind text not null default 'customer' check (sender_kind in ('staff', 'customer')),
  body        text not null check (length(btrim(body)) > 0),
  attachments jsonb not null default '[]'::jsonb,          -- [{document_id, name}]
  created_at  timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);

create table public.thread_reads (
  thread_id    uuid not null references public.threads (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create or replace function app.fill_message_sender()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  select full_name, kind into new.sender_name, new.sender_kind
  from public.profiles where id = new.sender_id;
  return new;
end;
$$;
create trigger messages_fill_sender before insert on public.messages
  for each row execute function app.fill_message_sender();

create or replace function app.touch_thread()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;
create trigger messages_touch_thread after insert on public.messages
  for each row execute function app.touch_thread();

create or replace function app.can_access_thread(tid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.threads t
    where t.id = tid
      and (app.has_global_permission('messages.manage')
           or app.has_project_permission(t.project_id, 'messages.use'))
  )
$$;
grant execute on function app.can_access_thread(uuid) to authenticated, service_role;

alter table public.threads      enable row level security;
alter table public.messages     enable row level security;
alter table public.thread_reads enable row level security;

create policy threads_read on public.threads for select to authenticated
  using (app.can_access_thread(id));
create policy threads_insert on public.threads for insert to authenticated
  with check (created_by = auth.uid() and app.has_project_permission(project_id, 'messages.use'));
create policy threads_update on public.threads for update to authenticated
  using (app.has_global_permission('messages.manage')) with check (app.has_global_permission('messages.manage'));

create policy messages_read on public.messages for select to authenticated
  using (app.can_access_thread(thread_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and app.can_access_thread(thread_id));

create policy thread_reads_own on public.thread_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and app.can_access_thread(thread_id));

-- Live updates for the chat UI (RLS still filters what each client receives).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Audit trail: who changed what, when. Attached to sensitive tables;
-- attach to future tables with one `create trigger ... app.audit_row()`.
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id  text,
  old_data   jsonb,
  new_data   jsonb
);
create index audit_logs_table_idx on public.audit_logs (table_name, at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, at desc);

create or replace function app.audit_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  -- never log secrets-ish noise
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'personnel_id', v_old ->> 'personnel_id'),
          v_old, v_new);
  return coalesce(new, old);
end;
$$;

create trigger audit_organizations  after insert or update or delete on public.organizations
  for each row execute function app.audit_row();
create trigger audit_projects       after insert or update or delete on public.projects
  for each row execute function app.audit_row();
create trigger audit_profiles       after insert or update or delete on public.profiles
  for each row execute function app.audit_row();
create trigger audit_project_members after insert or update or delete on public.project_members
  for each row execute function app.audit_row();
create trigger audit_overrides      after insert or update or delete on public.member_permission_overrides
  for each row execute function app.audit_row();
create trigger audit_personnel      after insert or update or delete on public.personnel
  for each row execute function app.audit_row();
create trigger audit_assignments    after insert or update or delete on public.personnel_assignments
  for each row execute function app.audit_row();
create trigger audit_documents      after insert or update or delete on public.documents
  for each row execute function app.audit_row();
create trigger audit_invoices       after insert or update or delete on public.invoices
  for each row execute function app.audit_row();
create trigger audit_payments       after insert or update or delete on public.payments
  for each row execute function app.audit_row();

alter table public.audit_logs enable row level security;
create policy audit_logs_read on public.audit_logs for select to authenticated
  using (app.has_global_permission('audit.read'));
-- no insert/update/delete policies: rows are written only by the trigger.
revoke insert, update, delete on public.audit_logs from authenticated;
