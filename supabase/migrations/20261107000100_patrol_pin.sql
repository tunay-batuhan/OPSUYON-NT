-- Devriye 2. tur (7 Kasım): giriş yok, QR + projenin 4 haneli PIN'i + isim seçimi (mobil uygulamaya kadar geçici çözüm).
--  * QR etiketi sitedeki herkese açık /d/<kod> sayfasını açar; görevli projenin PIN'ini girer,
--    PIN doğruysa o projede çalışan personel listelenir, kendi adını seçer, kayıt düşer.
--  * PIN proje başınadır, merkez verir ve görevlilerle paylaşır; personel adları PIN'den önce gösterilmez.
--  * Okutmada telefon izin verirse konum kaydedilir (zorunlu değil); noktanın konumu ilk isabetli okutmadan öğrenilir,
--    sonraki okutmaların noktaya uzaklığı tutulur (raporda uyarı için).
--  * Okutma kayıtları 1 ay saklanır, sonra otomatik silinir.
--  * Eski giriş yaparak okutma (patrol.scan, Devriye Görevlisi rolü, record_patrol_scan) kalkar.

-- ---------- noktanın konumu ----------
alter table public.patrol_points
  add column lat double precision,
  add column lng double precision;

-- ---------- okutma: personel + konum ----------
alter table public.patrol_scans
  add column personnel_id uuid references public.personnel (id) on delete set null,
  add column lat          double precision,
  add column lng          double precision,
  add column accuracy_m   integer,
  add column distance_m   integer;   -- noktanın bilinen konumuna uzaklık (metre); konum yoksa boş
create index patrol_scans_personnel_idx on public.patrol_scans (personnel_id, scanned_at desc);

-- ---------- proje PIN'i ----------
create table public.patrol_pins (
  project_id uuid primary key references public.projects (id) on delete cascade,
  pin        text not null check (pin ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger patrol_pins_updated_at before update on public.patrol_pins
  for each row execute function app.set_updated_at();
-- işlem geçmişine yazılmaz: PIN düz metin olarak log'a düşmesin. Yalnızca merkez görür/değiştirir.
alter table public.patrol_pins enable row level security;
create policy patrol_pins_staff on public.patrol_pins for all to authenticated
  using (app.has_global_permission('patrol.manage')) with check (app.has_global_permission('patrol.manage'));

-- ---------- hatalı PIN denemeleri (kaba kuvvete karşı) ----------
create table public.patrol_pin_failures (
  id         bigint generated always as identity primary key,
  point_id   uuid not null references public.patrol_points (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index patrol_pin_failures_point_idx on public.patrol_pin_failures (point_id, created_at desc);
alter table public.patrol_pin_failures enable row level security;   -- politika yok: yalnızca sunucu

-- ---------- eski okutma yolu kalkar ----------
drop function if exists public.record_patrol_scan(text);

drop policy if exists patrol_points_read on public.patrol_points;
create policy patrol_points_read on public.patrol_points for select to authenticated
  using (app.has_project_permission(project_id, 'patrol.read'));

-- patrol.scan izni ve onu kullanan rol/üyelik istisnaları (cascade) silinir
delete from public.permissions where code = 'patrol.scan';
do $$
begin
  delete from public.roles r
   where r.code = 'customer_patrol'
     and not exists (select 1 from public.project_members m where m.role_id = r.id);
  update public.roles
     set name = 'Devriye Görevlisi (kullanılmıyor)',
         description = 'Eski demo rolü. Devriye artık QR + proje PIN''i ile yapılır; bu rolle hesap açmayın.'
   where code = 'customer_patrol';
exception when others then
  raise notice 'customer_patrol rolü kaldırılamadı (%)', sqlerrm;
end $$;

-- ---------- QR + proje PIN'i (yalnızca sunucu çağırır) ----------
-- Hatalar exception yerine dönüş değeriyle bildirilir: hatalı PIN kaydı (kilit sayacı) geri alınmasın.

-- ortak denetim: kod aktif mi, nokta kilitli mi, PIN doğru mu. Doğruysa noktayı döndürür.
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
  if (select count(*) from public.patrol_pin_failures
       where point_id = v_point.id and created_at > now() - interval '10 minutes') >= 5 then
    v_error := 'Bu noktada çok fazla hatalı PIN denendi. 10 dakika sonra tekrar deneyin.';
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

-- 1. adım: PIN doğruysa projede bugün çalışan aktif personeli (seçim listesi) döndürür
create or replace function public.patrol_check_pin(p_code text, p_pin text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_point    public.patrol_points;
  v_point_id uuid;
  v_error    text;
  v_today    date := (now() at time zone 'Europe/Istanbul')::date;
begin
  select v.v_point_id, v.v_error into v_point_id, v_error from app.patrol_verify(p_code, p_pin) v;
  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', v_error);
  end if;
  select * into v_point from public.patrol_points where id = v_point_id;
  return jsonb_build_object('ok', true, 'people', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.full_name) order by x.full_name)
      from (select distinct p.id, p.full_name
              from public.personnel p
              join public.personnel_assignments a on a.personnel_id = p.id
             where p.status = 'active'
               and a.project_id = v_point.project_id
               and a.start_date <= v_today
               and (a.end_date is null or a.end_date >= v_today)) x
  ), '[]'::jsonb));
end;
$$;
revoke execute on function public.patrol_check_pin(text, text) from public, anon, authenticated;
grant  execute on function public.patrol_check_pin(text, text) to service_role;

-- 2. adım: seçilen personel adına okutmayı kaydeder (PIN yeniden denetlenir)
create or replace function public.record_patrol_scan_pin(
  p_code         text,
  p_pin          text,
  p_personnel_id uuid,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_accuracy     double precision default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_point    public.patrol_points;
  v_point_id uuid;
  v_error    text;
  v_project  text;
  v_name    text;
  v_today   date := (now() at time zone 'Europe/Istanbul')::date;
  v_now     timestamptz := now();
  v_last    timestamptz;
  v_lat     double precision;
  v_lng     double precision;
  v_acc     integer;
  v_dist    integer;
begin
  select v.v_point_id, v.v_error into v_point_id, v_error from app.patrol_verify(p_code, p_pin) v;
  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', v_error);
  end if;
  select * into v_point from public.patrol_points where id = v_point_id;

  -- seçilen kişi bu projede bugün çalışan aktif personel olmalı
  select p.full_name into v_name
    from public.personnel p
    join public.personnel_assignments a on a.personnel_id = p.id
   where p.id = p_personnel_id
     and p.status = 'active'
     and a.project_id = v_point.project_id
     and a.start_date <= v_today
     and (a.end_date is null or a.end_date >= v_today)
   limit 1;
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'Seçilen personel bu projede görünmüyor. Listeden adınızı seçin.');
  end if;

  select name into v_project from public.projects where id = v_point.project_id;

  -- aynı kişi aynı noktayı 20 sn içinde tekrar kaydederse (çift gönderim) yeni kayıt açılmaz
  select max(scanned_at) into v_last from public.patrol_scans
   where point_id = v_point.id and personnel_id = p_personnel_id and scanned_at > v_now - interval '20 seconds';
  if v_last is not null then
    return jsonb_build_object('ok', true, 'point', v_point.name, 'project', v_project, 'person', v_name,
                              'scanned_at', v_last, 'duplicate', true);
  end if;

  -- konum (isteğe bağlı)
  if p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_lat := p_lat;
    v_lng := p_lng;
    v_acc := case when p_accuracy is null or p_accuracy < 0 then null else least(round(p_accuracy), 100000)::integer end;
    if v_point.lat is null then
      -- noktanın konumu ilk isabetli (≤ 50 m) okutmadan öğrenilir
      if v_acc is not null and v_acc <= 50 then
        update public.patrol_points set lat = v_lat, lng = v_lng where id = v_point.id;
        v_dist := 0;
      end if;
    else
      v_dist := round(2 * 6371000 * asin(sqrt(
                  power(sin(radians(v_lat - v_point.lat) / 2), 2) +
                  cos(radians(v_point.lat)) * cos(radians(v_lat)) * power(sin(radians(v_lng - v_point.lng) / 2), 2)
                )))::integer;
    end if;
  end if;

  insert into public.patrol_scans (project_id, point_id, personnel_id, scanned_at, lat, lng, accuracy_m, distance_m)
  values (v_point.project_id, v_point.id, p_personnel_id, v_now, v_lat, v_lng, v_acc, v_dist);

  return jsonb_build_object('ok', true, 'point', v_point.name, 'project', v_project, 'person', v_name,
                            'scanned_at', v_now, 'duplicate', false);
end;
$$;
revoke execute on function public.record_patrol_scan_pin(text, text, uuid, double precision, double precision, double precision) from public, anon, authenticated;
grant  execute on function public.record_patrol_scan_pin(text, text, uuid, double precision, double precision, double precision) to service_role;

-- ---------- 1 aydan eski kayıtlar silinir ----------
create or replace function public.purge_old_patrol_data()
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.patrol_scans        where scanned_at < now() - interval '1 month';
  delete from public.patrol_pin_failures where created_at < now() - interval '1 day';
$$;
revoke execute on function public.purge_old_patrol_data() from public, anon, authenticated;
grant  execute on function public.purge_old_patrol_data() to service_role;

-- her gece çalışsın (pg_cron yoksa uygulama Devriye Kayıtları sayfası açılınca da çağırır)
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-old-patrol-data', '20 0 * * *', 'select public.purge_old_patrol_data()');
exception when others then
  raise notice 'pg_cron kurulamadı (%): uygulama tarafı yedeği kullanılacak', sqlerrm;
end $$;

select public.purge_old_patrol_data();

update public.app_modules
   set description = 'DEMO: henüz onaylanmadı. QR + proje PIN''i ile okutma, noktalar, okutma kayıtları (1 ay), günlük rapor (PDF)'
 where code = 'devriye';
