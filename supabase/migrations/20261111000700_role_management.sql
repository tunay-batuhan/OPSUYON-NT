-- Rol yönetimi + yetki yükseltme açıklarının kapatılması (11 Kasım).
--
-- YENİ: Süper Yönetici kendi rollerini tanımlayabilir (merkez rolleri ve müşteri rolleri) ve her rolün yetkilerini
--       seçebilir. Sistem rolleri silinemez ama yetkileri düzenlenebilir.
-- GÜVENLİK: Kurallar yalnızca arayüzde değil VERİTABANINDA uygulanır; Supabase adresi ve genel anahtarı herkese
--       açık olduğundan, giriş yapmış bir kullanıcı kendi oturumuyla tablolara doğrudan istek atabilir.
--       Bugüne kadar "kullanıcı yönetme" yetkisi olan bir merkez çalışanı kendi rolünü Süper Yönetici yapabiliyor,
--       kendine kişiye özel yetki verebiliyordu. Artık:
--         * rol tanımları, rol yetkileri ve merkez çalışanlarının kişiye özel yetkileri → yalnızca Süper Yönetici
--         * bir hesabın türü (merkez/müşteri) ve merkez rolü → yalnızca Süper Yönetici
--         * merkez hesapları (parola, kısıtlama dahil) → yalnızca Süper Yönetici
--         * müşteri rolleri ve müşteri istisnaları yalnızca "müşteriye verilebilir" yetkileri içerebilir
--         * son aktif Süper Yönetici silinemez, kısıtlanamaz, rolü düşürülemez

-- ---------- müşteriye verilebilir yetkiler ----------
alter table public.permissions add column if not exists customer_grantable boolean not null default false;

-- Raporlar ekranı kaldırıldı: izni de kalkar (rollerden ve istisnalardan cascade ile silinir)
delete from public.permissions where code = 'reports.read';

-- Müşteriye yalnızca "görme" yetkileri ve merkezle yazışma verilebilir; yönetim alanı ve tüm ".manage" yetkileri verilemez.
update public.permissions
   set customer_grantable = (module <> 'yonetim' and code not like '%.manage');

update public.permissions set description = 'Müşteri panelindeki ekranları aç / kapat; rol tanımlarını görüntüle' where code = 'access.manage';

-- mevcut veride kural dışı kalan varsa temizle (müşteri rolünde / müşteri istisnasında verilemeyen yetki)
delete from public.role_permissions rp
 using public.roles r, public.permissions p
 where r.id = rp.role_id and p.code = rp.permission_code and r.scope = 'customer' and not p.customer_grantable;
delete from public.member_permission_overrides o
 using public.permissions p
 where p.code = o.permission_code and o.is_allowed and not p.customer_grantable;
-- Süper Yönetici her şeye sahiptir; rol satırında yetki tutulmaz
delete from public.role_permissions rp using public.roles r where r.id = rp.role_id and r.code = 'super_admin';

-- ---------- kim Süper Yönetici? ----------
create or replace function app.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.roles r on r.id = p.staff_role_id
     where p.id = auth.uid() and p.kind = 'staff' and p.is_active and r.code = 'super_admin'
  )
$$;
revoke execute on function app.is_super_admin() from public, anon;
grant  execute on function app.is_super_admin() to authenticated;

-- ---------- politikalar: rol tanımları ve merkez istisnaları yalnızca Süper Yönetici ----------
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

drop policy if exists staff_overrides_write on public.staff_permission_overrides;
create policy staff_overrides_write on public.staff_permission_overrides for all to authenticated
  using (app.is_super_admin()) with check (app.is_super_admin());

-- yetki listesi koddan (migration) gelir; arayüzden değiştirilmez
drop policy if exists permissions_write on public.permissions;

-- ---------- rol tanımı kuralları ----------
create or replace function app.guard_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'Sistem rolleri silinemez.';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.code !~ '^[a-z][a-z0-9_]{2,48}$' then
      raise exception 'Rol kodu geçersiz.';
    end if;
    if new.scope not in ('staff', 'customer') then
      raise exception 'Rol kapsamı merkez ya da müşteri olmalı.';
    end if;
    if auth.uid() is not null then
      new.is_system := false; -- arayüzden açılan rol sistem rolü olamaz
    end if;
    return new;
  end if;
  -- UPDATE: kod, kapsam ve "sistem rolü" işareti değişmez (rolün anlamı sonradan kaydırılamaz)
  if new.code is distinct from old.code or new.scope is distinct from old.scope or new.is_system is distinct from old.is_system then
    raise exception 'Rolün kodu ve kapsamı değiştirilemez.';
  end if;
  return new;
end;
$$;
drop trigger if exists roles_guard on public.roles;
create trigger roles_guard before insert or update or delete on public.roles
  for each row execute function app.guard_roles();

create or replace function app.guard_role_permissions()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_code  text;
  v_scope text;
  v_ok    boolean;
begin
  select code, scope into v_code, v_scope from public.roles where id = new.role_id;
  if v_code = 'super_admin' then
    raise exception 'Süper Yönetici tüm yetkilere sahiptir; rolüne yetki eklenmez.';
  end if;
  if v_scope = 'customer' then
    select customer_grantable into v_ok from public.permissions where code = new.permission_code;
    if not coalesce(v_ok, false) then
      raise exception 'Bu yetki müşteri rollerine verilemez (%).', new.permission_code;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists role_permissions_guard on public.role_permissions;
create trigger role_permissions_guard before insert or update on public.role_permissions
  for each row execute function app.guard_role_permissions();

create or replace function app.guard_member_override()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if new.is_allowed then
    select customer_grantable into v_ok from public.permissions where code = new.permission_code;
    if not coalesce(v_ok, false) then
      raise exception 'Bu yetki müşteri hesaplarına verilemez (%).', new.permission_code;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists member_overrides_guard on public.member_permission_overrides;
create trigger member_overrides_guard before insert or update on public.member_permission_overrides
  for each row execute function app.guard_member_override();

-- ---------- hesap kuralları ----------
-- Kullanıcı oturumuyla gelen isteklerde (auth.uid() dolu) Süper Yönetici olmayan biri:
--   merkez hesabı açamaz, merkez hesabını değiştiremez/silemez, bir hesabın türünü ya da merkez rolünü değiştiremez.
-- Sunucunun servis istekleri (auth.uid() boş) uygulamadaki denetimlerden geçmiştir; yalnızca "son Süper Yönetici"
-- kuralı onlar için de geçerlidir.
create or replace function app.guard_profiles()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_super_role uuid := (select id from public.roles where code = 'super_admin');
  v_user       boolean := auth.uid() is not null;
  v_is_super   boolean := app.is_super_admin();
begin
  if v_user and not v_is_super then
    if tg_op = 'INSERT' then
      if new.kind <> 'customer' or new.staff_role_id is not null then
        raise exception 'Merkez hesabını yalnızca Süper Yönetici açabilir.';
      end if;
    elsif tg_op = 'UPDATE' then
      if old.kind = 'staff' then
        raise exception 'Merkez hesaplarını yalnızca Süper Yönetici değiştirebilir.';
      end if;
      if new.kind is distinct from old.kind or new.staff_role_id is distinct from old.staff_role_id then
        raise exception 'Hesap türünü ve merkez rolünü yalnızca Süper Yönetici değiştirebilir.';
      end if;
    elsif tg_op = 'DELETE' then
      if old.kind = 'staff' then
        raise exception 'Merkez hesaplarını yalnızca Süper Yönetici silebilir.';
      end if;
    end if;
  end if;

  -- son aktif Süper Yönetici korunur (her bağlamda)
  if tg_op in ('UPDATE', 'DELETE')
     and old.kind = 'staff' and old.is_active and old.staff_role_id = v_super_role
     and (tg_op = 'DELETE' or new.kind <> 'staff' or not new.is_active or new.staff_role_id is distinct from v_super_role)
     and not exists (
       select 1 from public.profiles p
        where p.id <> old.id and p.kind = 'staff' and p.is_active and p.staff_role_id = v_super_role
     ) then
    raise exception 'Son Süper Yönetici hesabı silinemez, kısıtlanamaz ve rolü değiştirilemez.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update or delete on public.profiles
  for each row execute function app.guard_profiles();

-- rol değişiklikleri de işlem geçmişine düşsün
drop trigger if exists audit_roles on public.roles;
create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function app.audit_row();
