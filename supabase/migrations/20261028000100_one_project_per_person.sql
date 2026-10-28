-- Kural: bir personel aynı anda EN FAZLA 1 projede görevli olabilir.
-- Başka bir projeye atanmak için önce mevcut projeden çıkarılması (Görevden al) gerekir.

-- 1) Mevcut çift atamaları temizle: personelin kendi firmasındaki atama kalır (eşitse en eskisi), diğerleri bugün kapatılır.
with ranked as (
  select a.id,
         row_number() over (
           partition by a.personnel_id
           order by (pr.organization_id is not distinct from p.organization_id) desc, a.start_date, a.created_at
         ) as rn
    from public.personnel_assignments a
    join public.personnel p  on p.id  = a.personnel_id
    join public.projects  pr on pr.id = a.project_id
   where a.end_date is null
)
update public.personnel_assignments a
   set end_date = greatest(current_date, a.start_date)
  from ranked r
 where a.id = r.id and r.rn > 1;

-- 2) Anlaşılır hata mesajı veren tetikleyici (yeni atama / yeniden açma)
create or replace function app.validate_single_active_assignment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_project text;
begin
  if new.end_date is null then
    select pr.name into v_project
      from public.personnel_assignments a
      join public.projects pr on pr.id = a.project_id
     where a.personnel_id = new.personnel_id
       and a.end_date is null
       and a.id is distinct from new.id
     limit 1;
    if found then
      raise exception 'Bu personel şu anda "%" projesinde görevli. Bir personel aynı anda yalnızca 1 projede olabilir: önce o projeden çıkarın (Görevden al), sonra bu projeye atayın.', v_project;
    end if;
  end if;
  return new;
end;
$$;

create trigger personnel_assignments_single_active
  before insert or update of personnel_id, end_date on public.personnel_assignments
  for each row execute function app.validate_single_active_assignment();

-- 3) Güvence: eşzamanlı isteklerde de ikinci aktif atama olamaz
create unique index personnel_assignments_one_active
  on public.personnel_assignments (personnel_id)
  where end_date is null;
