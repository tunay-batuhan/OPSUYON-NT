-- İşlem geçmişi (9 Kasım, 2): "Sistem" yerine işlemi yapan görünsün.
--  * Uygulama bazı işlemleri tam yetkili (service_role) bağlantıyla yapar (hesap açma, hesabı kısıtlama, yeni projede
--    firma yöneticilerine erişim). Bu bağlantıda auth.uid() boştur; uygulama işlemi yapan kullanıcıyı `x-actor-id`
--    başlığıyla gönderir. Başlık YALNIZCA service_role isteklerinde dikkate alınır (normal kullanıcı başlıkla başkası gibi görünemez).
--  * Hesabı olmayan işlemler için `actor_note` (ör. devriye görevlisinin okutmasıyla noktanın konumu öğrenildiğinde
--    "Devriye okutması: Ahmet Yılmaz").

alter table public.audit_logs add column if not exists actor_note text;

create or replace function app.audit_row()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old   jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new   jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_noise text[] := array['updated_at', 'last_login_at'];
  v_actor uuid := auth.uid();
  v_note  text := nullif(current_setting('app.audit_note', true), '');
begin
  -- yalnızca gürültü alanları değişen güncellemeler atlanır (ör. her girişte son giriş saati)
  if tg_op = 'UPDATE' and (v_old - v_noise) = (v_new - v_noise) then
    return new;
  end if;

  -- tam yetkili bağlantıda işlemi yapan, uygulamanın gönderdiği başlıktan alınır
  if v_actor is null then
    begin
      if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role' then
        v_actor := nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-actor-id', '')::uuid;
      end if;
    exception when others then
      v_actor := null; -- bozuk başlık kaydı engellemesin
    end;
  end if;

  insert into public.audit_logs (actor_id, actor_note, action, table_name, record_id, old_data, new_data)
  values (v_actor, v_note, tg_op, tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'personnel_id', v_old ->> 'personnel_id'),
          v_old, v_new);
  return coalesce(new, old);
end;
$$;

-- Devriye okutması: noktanın konumu okutmadan öğrenildiğinde işlem geçmişinde okutan personelin adı görünsün.
-- (Fonksiyonun geri kalanı 20261107000100_patrol_pin.sql ile aynı; yalnızca set_config satırı eklendi.)
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
        perform set_config('app.audit_note', 'Devriye okutması: ' || v_name, true);
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

-- geçmiş kayıtlar: okutmayla öğrenilen konumlar "Devriye okutması" olarak işaretlenir
update public.audit_logs
   set actor_note = 'Devriye okutması'
 where actor_id is null and actor_note is null and table_name = 'patrol_points' and action = 'UPDATE'
   and (old_data ->> 'lat') is null and (new_data ->> 'lat') is not null;
