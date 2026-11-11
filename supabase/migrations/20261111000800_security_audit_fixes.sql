-- Bağımsız güvenlik denetiminin bulguları (11 Kasım).
--
-- H1  Müşteri hesapları (en düşük "Firma Görüntüleyici" dahil) personelin kişisel bilgilerini (doğum tarihi, ev adresi,
--     telefon, yakınının telefonu, beden ölçüleri) doğrudan veritabanı isteğiyle okuyabiliyordu; arayüz göstermese de.
--     → Kişisel sütunlar `personnel` tablosundan OKUNAMAZ; yalnızca `personnel_personal` görünümünden ve yalnızca
--       "personelin kişisel bilgilerini gör" yetkisi olanlarca okunur (müşterilere verilemez).
-- M2  Bir firmada çalışmış personel başka firmaya geçince eski firma onun güncel kaydını ve yeni firmadaki izinlerini
--     görmeye devam ediyordu. → Müşteri bir personeli yalnızca personel HÂLÂ o firmanın kadrosundaysa görür; izin
--     kayıtları ayrıca kendi projesine göre süzülür.
-- M3  Devriye PIN'i için hatalı deneme sınırı etiket başınaydı; projenin tüm etiketleri aynı PIN'i doğruladığından
--     etiketler arasında gezinerek sınır aşılabiliyordu. → Sınır proje başına.

-- ---------- H1: kişisel bilgiler ----------
insert into public.permissions (code, module, description, sort_order, customer_grantable)
select 'personnel.personal.read', 'personel',
       'Personelin kişisel bilgilerini gör (doğum tarihi, adres, telefon, yakını, beden ölçüleri)',
       (select sort_order from public.permissions where code = 'personnel.read'), false
 where not exists (select 1 from public.permissions where code = 'personnel.personal.read');

-- bugüne kadar personeli gören merkez rolleri kişisel bilgileri de görüyordu: aynen sürsün
insert into public.role_permissions (role_id, permission_code)
select rp.role_id, 'personnel.personal.read'
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id and r.scope = 'staff'
 where rp.permission_code = 'personnel.read'
on conflict do nothing;
insert into public.staff_permission_overrides (user_id, permission_code, is_allowed)
select o.user_id, 'personnel.personal.read', o.is_allowed
  from public.staff_permission_overrides o
 where o.permission_code = 'personnel.read'
on conflict do nothing;

-- TC kimlik / IBAN da müşteriye verilemez
update public.permissions set customer_grantable = false where code = 'personnel.sensitive.read';
delete from public.role_permissions rp using public.roles r
 where r.id = rp.role_id and r.scope = 'customer' and rp.permission_code in ('personnel.sensitive.read', 'personnel.personal.read');
delete from public.member_permission_overrides
 where is_allowed and permission_code in ('personnel.sensitive.read', 'personnel.personal.read');

-- (personnel tablosundaki kişisel sütunların okunmasının kapatılması ayrı adımdır: 20261111000900. Önce yeni kod
--  yayına girer ve kişisel bilgileri bu görünümden okur; sonra sütunlar kapatılır. Böylece canlı site kesintisiz kalır.)

-- kişisel bilgiler: yalnızca yetkisi olanlara (görünüm sahibinin haklarıyla okur; süzgeç içindedir)
create or replace view public.personnel_personal
with (security_barrier = true) as
  select p.id as personnel_id, p.phone, p.email, p.birth_date, p.birth_place, p.hometown, p.address, p.marital_status,
         p.height_cm, p.weight_kg, p.pants_size, p.shirt_size, p.coat_size, p.shoe_size,
         p.emergency_phone, p.emergency_contact_name, p.notes, p.metadata
    from public.personnel p
   where app.can_access_personnel(p.id, 'personnel.personal.read');
revoke all on public.personnel_personal from public, anon;
grant select on public.personnel_personal to authenticated;

-- ---------- M2: firma değiştiren personel ----------
create or replace function app.can_access_personnel(pid uuid, perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    app.has_global_permission(perm)
    or exists (
      select 1
        from public.personnel_assignments a
        join public.projects pr on pr.id = a.project_id
        join public.personnel p on p.id = a.personnel_id
       where a.personnel_id = pid
         and p.organization_id = pr.organization_id   -- personel hâlâ bu firmanın kadrosunda
         and app.has_project_permission(a.project_id, perm)
    )
$$;

drop policy if exists leave_records_read on public.leave_records;
create policy leave_records_read on public.leave_records for select to authenticated
  using (
    app.has_global_permission('leaves.read')
    or (
      app.can_access_personnel(personnel_id, 'leaves.read')
      and (project_id is null or app.has_project_permission(project_id, 'leaves.read'))
    )
  );

-- ---------- M3: PIN deneme sınırı proje başına ----------
create or replace function app.patrol_verify(p_code text, p_pin text, out v_point_id uuid, out v_error text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_point public.patrol_points;
begin
  select * into v_point from public.patrol_points where code = upper(btrim(p_code)) and is_active;
  if not found then
    v_error := 'Bu QR kodu tanınmadı veya devre dışı bırakılmış.';
    return;
  end if;
  -- projenin TÜM etiketlerindeki hatalı denemeler birlikte sayılır (hepsi aynı PIN'i doğrular)
  if (select count(*)
        from public.patrol_pin_failures f
        join public.patrol_points pp on pp.id = f.point_id
       where pp.project_id = v_point.project_id and f.created_at > now() - interval '10 minutes') >= 5 then
    v_error := 'Bu projede çok fazla hatalı PIN denendi. 10 dakika sonra tekrar deneyin.';
    return;
  end if;
  if not exists (select 1 from public.patrol_pins where project_id = v_point.project_id and pin = btrim(coalesce(p_pin, ''))) then
    insert into public.patrol_pin_failures (point_id) values (v_point.id);
    v_error := 'PIN hatalı. Tekrar deneyin.';
    return;
  end if;
  v_point_id := v_point.id;
end;
$$;
revoke execute on function app.patrol_verify(text, text) from public, anon, authenticated;
