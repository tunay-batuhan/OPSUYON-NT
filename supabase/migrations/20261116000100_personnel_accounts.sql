-- Personel hesapları (16 Kasım).
--
-- Personel (güvenlik görevlisi, temizlik personeli…) kendi telefonundan giriş yapar: kendisine atanan görevleri
-- (İş Planlama) ve onaylanmış bordrolarını görür. Hesabı merkez ya da yetkili site müdürü (müşteri hesabı) açar.
--   * profiles.kind'a üçüncü tür: 'personnel'. Hesap bir personel kartına bağlıdır (profiles.personnel_id, 1-1).
--   * Personel hesabının hiçbir rolü/yetkisi yoktur: mevcut RLS kurallarının tamamı (has_global_permission,
--     has_project_permission) onu dışarıda bırakır. Personelin kendi verisi yalnızca kendi personnel_id'si
--     üzerinden, sunucuda okunur ve aşağıdaki/sonraki dosyalardaki fonksiyonlarla değiştirilir.
--   * İlk girişte parola değiştirmek zorunludur (must_change_password).
--   * Personel kartı "Ayrıldı" yapılınca hesabı da kapanır.
-- Yalnızca ekleme: mevcut satırlar ve kurallar değişmez.

-- ---------- hesap türü ----------
alter table public.profiles drop constraint if exists profiles_kind_check;
alter table public.profiles add constraint profiles_kind_check check (kind in ('staff', 'customer', 'personnel'));

alter table public.profiles add column if not exists personnel_id uuid references public.personnel (id) on delete restrict;
alter table public.profiles add column if not exists must_change_password boolean not null default false;

create unique index if not exists profiles_personnel_key on public.profiles (personnel_id) where personnel_id is not null;

alter table public.profiles add constraint profiles_personnel_link
  check ((kind = 'personnel') = (personnel_id is not null));
alter table public.profiles add constraint profiles_personnel_plain
  check (kind <> 'personnel' or (organization_id is null and staff_role_id is null));

-- ---------- oturumdaki personel ----------
create or replace function app.my_personnel_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select personnel_id from public.profiles
   where id = auth.uid() and kind = 'personnel' and is_active
$$;
revoke execute on function app.my_personnel_id() from public, anon;
grant execute on function app.my_personnel_id() to authenticated, service_role;

-- ---------- yetki: personel hesaplarını yönet ----------
insert into public.permissions (code, module, description, sort_order, customer_grantable) values
  ('personnel.accounts', 'personel', 'Personel hesaplarını aç, parolasını sıfırla, kapat', 45, true)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_code)
select r.id, 'personnel.accounts' from public.roles r where r.code in ('manager', 'operator', 'customer_manager', 'customer_hr')
on conflict do nothing;

-- ---------- müşteri/merkez ekranı: hangi personelin hesabı var ----------
-- profiles tablosunu müşteri okuyamaz; yalnızca personelini görebildiği kişilerin hesap özeti döner.
create or replace function public.personnel_accounts(p_ids uuid[])
returns table (personnel_id uuid, user_id uuid, username text, is_active boolean, last_login_at timestamptz, must_change_password boolean)
language sql stable security definer
set search_path = ''
as $$
  select p.personnel_id, p.id, p.username::text, p.is_active, p.last_login_at, p.must_change_password
    from public.profiles p
   where p.kind = 'personnel'
     and p.personnel_id = any (p_ids)
     and app.can_access_personnel(p.personnel_id, 'personnel.read')
$$;
revoke execute on function public.personnel_accounts(uuid[]) from public, anon;
grant execute on function public.personnel_accounts(uuid[]) to authenticated;

-- ---------- ayrılan personelin hesabı kapanır ----------
create or replace function app.personnel_account_follow_status()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status = 'terminated' and old.status is distinct from 'terminated' then
    update public.profiles set is_active = false where personnel_id = new.id and kind = 'personnel' and is_active;
  end if;
  return new;
end;
$$;
drop trigger if exists personnel_account_status on public.personnel;
create trigger personnel_account_status after update of status on public.personnel
  for each row execute function app.personnel_account_follow_status();
