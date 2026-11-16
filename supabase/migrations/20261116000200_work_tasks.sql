-- İş Planlama (16 Kasım).
--
-- Site müdürü (müşteri hesabı, "tasks.assign") ya da merkez, projedeki bir personele görev atar. Personel
-- telefonundan görevi kabul eder ya da "Sorun var" deyip açıklama yazar. Kabul edilen göreve müdür tarih/saat
-- verir; iş bitince personel isterse fotoğraf ekleyip "İşi bitirdim" der, müdür "Tamamlandı" ile kapatır.
--
--   durum (status)   anlamı
--   pending          Onay bekleyen: personel henüz yanıt vermedi (müdür sorunu düzeltip yeniden gönderince de)
--   issue            Sorun bildirilen: personel açıklama yazdı, müdür müdahalesi bekleniyor
--   accepted         Kabul edildi: tarih verildiyse "Planlanan", verilmediyse "Tarih bekliyor"
--   done             Tamamlandı (müdür kapattı)
--   cancelled        İptal
--
-- Kurallar veritabanında: görev yalnızca projede AKTİF görevli personele atanır; personelin yapabildikleri
-- (kabul, sorun, bitirdim) yalnızca kendi görevinde ve uygun durumda public.task_respond ile yapılır.
-- Görevdeki her adım work_task_events'e kendiliğinden yazılır (kim, ne zaman).

-- ---------- yetkiler ----------
insert into public.permissions (code, module, description, sort_order, customer_grantable) values
  ('tasks.read',   'isplanlama', 'Görevleri görüntüle ve PDF indir',                     90, true),
  ('tasks.assign', 'isplanlama', 'Görev ata, düzenle, tarih ver, tamamla veya iptal et', 91, true)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
  from (values
    ('manager', 'tasks.read'), ('manager', 'tasks.assign'),
    ('operator', 'tasks.read'), ('operator', 'tasks.assign'),
    ('customer_manager', 'tasks.read'), ('customer_manager', 'tasks.assign'),
    ('customer_hr', 'tasks.read'), ('customer_hr', 'tasks.assign'),
    ('customer_viewer', 'tasks.read')
  ) as p(role_code, code)
  join public.roles r on r.code = p.role_code
on conflict do nothing;

insert into public.app_modules (code, name, description, enabled, implemented, sort_order) values
  ('is_planlama', 'İş Planlama', 'Personele görev atama, personel onayı, tarih/saat, PDF', true, true, 115)
on conflict (code) do nothing;

-- ---------- görevler ----------
create table public.work_tasks (
  id                       uuid primary key default gen_random_uuid(),
  project_id               uuid not null references public.projects (id) on delete restrict,
  personnel_id             uuid not null references public.personnel (id) on delete restrict,
  title                    text not null check (char_length(title) between 2 and 160),
  job                      text check (char_length(job) <= 80),            -- "Görevi": Temizlik Personeli…
  description              text check (char_length(description) <= 4000),
  location                 text check (char_length(location) <= 160),
  planned_date             date,
  planned_time             time,
  status                   text not null default 'pending' check (status in ('pending', 'issue', 'accepted', 'done', 'cancelled')),
  issue_note               text check (char_length(issue_note) <= 2000),
  issue_at                 timestamptz,
  accepted_at              timestamptz,
  finished_by_personnel_at timestamptz,                                     -- personel "İşi bitirdim" dedi
  finish_note              text check (char_length(finish_note) <= 2000),
  completed_at             timestamptz,
  completed_by             uuid references public.profiles (id) on delete set null,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (planned_time is null or planned_date is not null)
);
create index work_tasks_project_status_idx   on public.work_tasks (project_id, status);
create index work_tasks_personnel_status_idx on public.work_tasks (personnel_id, status);
create index work_tasks_created_idx          on public.work_tasks (created_at desc);
create trigger work_tasks_updated_at before update on public.work_tasks
  for each row execute function app.set_updated_at();

-- Görev yalnızca o projede aktif görevli personele verilir; durum değişince ilgili zaman damgaları dolar.
create or replace function app.work_tasks_before()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.personnel_id is distinct from old.personnel_id or new.project_id is distinct from old.project_id then
    if not exists (
      select 1 from public.personnel_assignments a
       where a.personnel_id = new.personnel_id and a.project_id = new.project_id and a.end_date is null
    ) then
      raise exception 'Bu personel seçilen projede görevli değil; görev yalnızca projedeki aktif personele atanabilir.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.status not in ('pending', 'accepted') then
      new.status := 'pending';
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'accepted' then
      new.accepted_at := coalesce(new.accepted_at, now());
    elsif new.status = 'issue' then
      new.issue_at := now();
    elsif new.status = 'done' then
      new.completed_at := now();
      new.completed_by := coalesce(auth.uid(), new.completed_by);
    elsif new.status = 'pending' then
      -- yeniden onaya gönderildi: önceki kabul ve "bitirdim" bilgisi sıfırlanır (geçmiş olay kaydında durur)
      new.accepted_at := null;
      new.finished_by_personnel_at := null;
      new.finish_note := null;
    end if;
    if new.status <> 'done' then
      new.completed_at := null;
      new.completed_by := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger work_tasks_before before insert or update on public.work_tasks
  for each row execute function app.work_tasks_before();

-- ---------- olay geçmişi ----------
create table public.work_task_events (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references public.work_tasks (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  actor_name text,
  kind       text not null check (kind in ('created', 'updated', 'reassigned', 'accepted', 'issue', 'scheduled', 'finished', 'completed', 'reopened', 'resent', 'cancelled', 'file')),
  note       text,
  created_at timestamptz not null default now()
);
create index work_task_events_task_idx on public.work_task_events (task_id, created_at);

create or replace function app.work_task_log(p_task uuid, p_kind text, p_note text)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.work_task_events (task_id, actor_id, actor_name, kind, note)
  values (p_task, auth.uid(), (select full_name from public.profiles where id = auth.uid()), p_kind, p_note)
$$;
revoke execute on function app.work_task_log(uuid, text, text) from public, anon, authenticated;

create or replace function app.work_tasks_after()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_when text;
begin
  if tg_op = 'INSERT' then
    perform app.work_task_log(new.id, 'created', new.title);
    return new;
  end if;

  if new.personnel_id is distinct from old.personnel_id then
    perform app.work_task_log(new.id, 'reassigned', (select full_name from public.personnel where id = new.personnel_id));
  end if;

  if new.status is distinct from old.status then
    perform app.work_task_log(
      new.id,
      case new.status
        when 'accepted'  then case when old.status = 'done' then 'reopened' else 'accepted' end
        when 'issue'     then 'issue'
        when 'done'      then 'completed'
        when 'cancelled' then 'cancelled'
        when 'pending'   then 'resent'
      end,
      case when new.status = 'issue' then new.issue_note end
    );
  end if;

  if new.finished_by_personnel_at is not null and old.finished_by_personnel_at is null then
    perform app.work_task_log(new.id, 'finished', new.finish_note);
  end if;

  if (new.planned_date, new.planned_time) is distinct from (old.planned_date, old.planned_time) then
    v_when := case
      when new.planned_date is null then 'Tarih kaldırıldı'
      else to_char(new.planned_date, 'DD.MM.YYYY') || coalesce(' ' || to_char(new.planned_time, 'HH24:MI'), '')
    end;
    perform app.work_task_log(new.id, 'scheduled', v_when);
  end if;

  if (new.title, new.job, new.description, new.location) is distinct from (old.title, old.job, old.description, old.location) then
    perform app.work_task_log(new.id, 'updated', null);
  end if;
  return new;
end;
$$;
create trigger work_tasks_after after insert or update on public.work_tasks
  for each row execute function app.work_tasks_after();

-- ---------- dosyalar (görev fotoğrafı / belge) ----------
-- Dosyalar özel 'documents' kovasında 'tasks/{task_id}/…' altında durur. Yükleme ve indirme sunucuda, görevin
-- okuma yetkisi doğrulandıktan sonra imzalı adresle yapılır (satırları yalnızca sunucu yazar).
create table public.work_task_files (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.work_tasks (id) on delete cascade,
  stage       text not null check (stage in ('assign', 'issue', 'finish')),
  storage_path text not null unique,
  file_name   text not null check (char_length(file_name) <= 255),
  mime_type   text,
  size_bytes  bigint check (size_bytes is null or (size_bytes > 0 and size_bytes <= 52428800)),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (storage_path like 'tasks/' || task_id::text || '/%')
);
create index work_task_files_task_idx on public.work_task_files (task_id);

create or replace function app.work_task_files_after()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.work_task_events (task_id, actor_id, actor_name, kind, note)
  values (new.task_id, new.uploaded_by, (select full_name from public.profiles where id = new.uploaded_by), 'file', new.file_name);
  return new;
end;
$$;
create trigger work_task_files_after after insert on public.work_task_files
  for each row execute function app.work_task_files_after();

-- ---------- erişim ----------
alter table public.work_tasks       enable row level security;
alter table public.work_task_events enable row level security;
alter table public.work_task_files  enable row level security;

create policy work_tasks_read on public.work_tasks for select to authenticated
  using (app.has_project_permission(project_id, 'tasks.read') or personnel_id = app.my_personnel_id());
create policy work_tasks_insert on public.work_tasks for insert to authenticated
  with check (app.has_project_permission(project_id, 'tasks.assign'));
create policy work_tasks_update on public.work_tasks for update to authenticated
  using (app.has_project_permission(project_id, 'tasks.assign'))
  with check (app.has_project_permission(project_id, 'tasks.assign'));
create policy work_tasks_delete on public.work_tasks for delete to authenticated
  using (app.has_project_permission(project_id, 'tasks.assign'));

-- olaylar ve dosyalar: görevi görebilen görür (alt sorgu work_tasks kurallarına tabidir); yazma yalnızca tetikleyici/sunucu
create policy work_task_events_read on public.work_task_events for select to authenticated
  using (exists (select 1 from public.work_tasks t where t.id = task_id));
create policy work_task_files_read on public.work_task_files for select to authenticated
  using (exists (select 1 from public.work_tasks t where t.id = task_id));

revoke insert, update, delete on public.work_task_events from authenticated;
revoke insert, update, delete on public.work_task_files  from authenticated;

-- ---------- personelin yanıtı ----------
-- accept : bekleyen (ya da sorun bildirdiği) görevi kabul eder
-- issue  : bekleyen ya da kabul ettiği görevde sorun bildirir (açıklama zorunlu)
-- finish : kabul ettiği görevi "bitirdim" olarak işaretler (not isteğe bağlı); son onayı müdür verir
create or replace function public.task_respond(p_task uuid, p_action text, p_note text default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pid  uuid := app.my_personnel_id();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  t      public.work_tasks;
begin
  if v_pid is null then
    raise exception 'Bu işlem yalnızca personel hesabıyla yapılabilir.';
  end if;
  select * into t from public.work_tasks where id = p_task and personnel_id = v_pid for update;
  if not found then
    raise exception 'Görev bulunamadı.';
  end if;
  if char_length(v_note) > 2000 then
    raise exception 'Açıklama en fazla 2000 karakter olabilir.';
  end if;

  if p_action = 'accept' then
    if t.status not in ('pending', 'issue') then
      raise exception 'Bu görev artık onay beklemiyor.';
    end if;
    update public.work_tasks set status = 'accepted' where id = t.id;
    return 'accepted';
  elsif p_action = 'issue' then
    if t.status not in ('pending', 'accepted', 'issue') then
      raise exception 'Bu görevde sorun bildirilemez.';
    end if;
    if v_note is null or char_length(v_note) < 3 then
      raise exception 'Lütfen sorunu kısaca yazın.';
    end if;
    update public.work_tasks set status = 'issue', issue_note = v_note where id = t.id;
    if t.status = 'issue' then
      -- zaten sorun bildirilmişti: açıklama güncellendi, olay kaydına ayrıca yazılır
      perform app.work_task_log(t.id, 'issue', v_note);
    end if;
    return 'issue';
  elsif p_action = 'finish' then
    if t.status <> 'accepted' then
      raise exception 'Yalnızca kabul ettiğiniz görevi bitirdi olarak işaretleyebilirsiniz.';
    end if;
    if t.finished_by_personnel_at is not null then
      raise exception 'Bu görevi zaten bitirdi olarak işaretlediniz.';
    end if;
    update public.work_tasks set finished_by_personnel_at = now(), finish_note = v_note where id = t.id;
    return 'finished';
  end if;
  raise exception 'Geçersiz işlem.';
end;
$$;
revoke execute on function public.task_respond(uuid, text, text) from public, anon;
grant execute on function public.task_respond(uuid, text, text) to authenticated;

-- ---------- işlem geçmişi ----------
create trigger audit_work_tasks after insert or update or delete on public.work_tasks
  for each row execute function app.audit_row();
