-- 27 Kasım: İş Planlama'da merkez görevleri (merkez kullanıcıları arası görevlendirme).
--
-- Bugüne kadar görev yalnızca bir projede AKTİF görevli saha personeline atanabiliyordu. Artık merkezde görev atama
-- yetkisi olan kullanıcı, başka bir merkez kullanıcısına da görev verebilir ("merkez görevi"):
--
--   saha görevi   : project_id + personnel_id dolu, assignee_id boş  (bugünkü kayıtların tamamı; değişmez)
--   merkez görevi : assignee_id dolu (profiles.id), project_id ve personnel_id boş
--
-- Akış aynıdır: görevi alan kabul eder / sorun bildirir / "bitirdim" der (public.task_respond), görevi veren kapatır.
-- Müşteri hesapları merkez görevlerini göremez: müşteri yetkisi proje üyeliğinden gelir, merkez görevinde proje yoktur.
--
-- Bu dosyayı yayından ÖNCE Supabase SQL Editor'de çalıştırın; tekrar çalıştırmak zararsızdır.

-- ---------- sütunlar ----------
alter table public.work_tasks
  alter column project_id drop not null,
  alter column personnel_id drop not null,
  add column if not exists assignee_id uuid references public.profiles (id) on delete restrict;

alter table public.work_tasks drop constraint if exists work_tasks_target_check;
alter table public.work_tasks add constraint work_tasks_target_check check (
  (assignee_id is null and project_id is not null and personnel_id is not null)
  or (assignee_id is not null and project_id is null and personnel_id is null)
);

create index if not exists work_tasks_assignee_status_idx on public.work_tasks (assignee_id, status) where assignee_id is not null;

-- ---------- kurallar ----------
-- Saha görevi: yalnızca projede aktif görevli personele. Merkez görevi: yalnızca aktif merkez kullanıcısına.
-- Görevin türü sonradan değiştirilemez. Durum değişince ilgili zaman damgaları dolar (öncekiyle aynı).
create or replace function app.work_tasks_before()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.assignee_id is null) is distinct from (old.assignee_id is null) then
    raise exception 'Görevin türü (saha / merkez) değiştirilemez.';
  end if;

  if new.assignee_id is not null then
    if tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id then
      if not exists (
        select 1 from public.profiles p where p.id = new.assignee_id and p.kind = 'staff' and p.is_active
      ) then
        raise exception 'Merkez görevi yalnızca aktif bir merkez kullanıcısına atanabilir.';
      end if;
    end if;
  elsif tg_op = 'INSERT' or new.personnel_id is distinct from old.personnel_id or new.project_id is distinct from old.project_id then
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

-- Olay geçmişi: görev başka bir merkez kullanıcısına verilince de "reassigned" yazılır.
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
  if new.assignee_id is distinct from old.assignee_id then
    perform app.work_task_log(new.id, 'reassigned', (select full_name from public.profiles where id = new.assignee_id));
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

-- ---------- erişim ----------
-- Okuma: saha görevinde kural aynı (projede tasks.read ya da görev personelin kendisine ait).
-- Merkez görevini yalnızca merkez görür: tasks.read yetkisi olan, görevin atandığı kullanıcı ya da görevi veren.
-- Yazma kuralları (insert / update / delete) değişmedi: has_project_permission proje boşken yalnızca merkezin
-- genel yetkisine (tasks.assign) bakar; müşteri üyeliği proje gerektirdiği için müşteri merkez görevi yazamaz.
drop policy if exists work_tasks_read on public.work_tasks;
create policy work_tasks_read on public.work_tasks for select to authenticated
  using (
    case
      when assignee_id is null then
        app.has_project_permission(project_id, 'tasks.read') or personnel_id = app.my_personnel_id()
      else
        app.is_staff() and (app.has_global_permission('tasks.read') or assignee_id = auth.uid() or created_by = auth.uid())
    end
  );

-- ---------- görevi alanın yanıtı ----------
-- Saha görevinde personel (kendi görevi), merkez görevinde görevin atandığı merkez kullanıcısı yanıtlar.
-- accept : bekleyen (ya da sorun bildirdiği) görevi kabul eder
-- issue  : bekleyen ya da kabul ettiği görevde sorun bildirir (açıklama zorunlu)
-- finish : kabul ettiği görevi "bitirdim" olarak işaretler (not isteğe bağlı); son onayı görevi veren verir
create or replace function public.task_respond(p_task uuid, p_action text, p_note text default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pid  uuid := app.my_personnel_id();
  v_uid  uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  t      public.work_tasks;
begin
  if v_pid is null and not app.is_staff() then
    raise exception 'Bu işlem yalnızca görevin atandığı kişi tarafından yapılabilir.';
  end if;
  select * into t from public.work_tasks
   where id = p_task
     and ((v_pid is not null and personnel_id = v_pid) or (v_pid is null and assignee_id = v_uid))
     for update;
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
