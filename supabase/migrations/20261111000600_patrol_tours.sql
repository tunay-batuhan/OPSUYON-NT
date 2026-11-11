-- Devriye TURU (11 Kasım): devriye başlatılıp bitirilen bir iştir (manyetik kalem/anahtar sisteminin QR karşılığı).
--   1) Görevli projenin "Devriye başlat / bitir" QR'ını okutur → proje PIN'i + adını seçer → tur başlar.
--      Telefon bu turla eşleşir (çerez: token; veritabanında yalnızca özeti durur).
--   2) Diğer nokta QR'ları okutulur: PIN ve ad SORULMAZ, okutma açık tura yazılır. Sıra serbesttir.
--      Tur başlatılmadan nokta okutulursa kayıt yapılmaz ("önce başlat").
--   3) "Başlat / bitir" QR'ı tekrar okutulur → ekranda durum ve atlanan noktalar çıkar → "Devriyeyi bitir".
--      (Kendiliğinden bitmez: yanlışlıkla iki kez okutma turu kapatmaz.)
--   Bitirilmeyen tur, son okutmadan 1 saat sonra "zaman aşımı" ile kapanır.

-- ---------- başlat / bitir etiketi: her projede bir tane ----------
alter table public.patrol_points
  add column if not exists kind text not null default 'nokta' check (kind in ('nokta', 'tur'));
create unique index if not exists patrol_points_one_tour on public.patrol_points (project_id) where kind = 'tur';

-- QR içeriği: DVR-XXXXXXXX (karışan harfler yok); uygulamadaki newPointCode() ile aynı biçim
create or replace function app.new_patrol_code()
returns text
language sql volatile
set search_path = ''
as $$
  select 'DVR-' || string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', (get_byte(u.b, i) % 32) + 1, 1), '')
    from (select uuid_send(gen_random_uuid()) as b) u, unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) as i;
$$;

-- projeye ilk nokta eklenince başlat/bitir etiketi de açılır
create or replace function app.patrol_ensure_tour_point()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.kind = 'nokta' and not exists (select 1 from public.patrol_points where project_id = new.project_id and kind = 'tur') then
    insert into public.patrol_points (project_id, name, code, kind, sort_order)
    values (new.project_id, 'Devriye başlat / bitir', app.new_patrol_code(), 'tur', -1);
  end if;
  return new;
end;
$$;
drop trigger if exists patrol_points_ensure_tour on public.patrol_points;
create trigger patrol_points_ensure_tour after insert on public.patrol_points
  for each row execute function app.patrol_ensure_tour_point();

insert into public.patrol_points (project_id, name, code, kind, sort_order)
select p.project_id, 'Devriye başlat / bitir', app.new_patrol_code(), 'tur', -1
  from (select distinct project_id from public.patrol_points) p
 where not exists (select 1 from public.patrol_points t where t.project_id = p.project_id and t.kind = 'tur');

-- ---------- turlar ----------
create table if not exists public.patrol_tours (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  personnel_id  uuid references public.personnel (id) on delete set null,
  person_name   text not null,
  token_hash    text not null,                      -- telefondaki çerezin SHA-256 özeti
  started_at    timestamptz not null default now(),
  last_scan_at  timestamptz not null default now(),
  ended_at      timestamptz,
  end_kind      text check (end_kind in ('bitti', 'zaman_asimi', 'yeni_tur')),
  points_total  integer not null default 0,         -- tur kapanırken: okutulan + atlanan
  points_done   integer not null default 0,         -- okutulan farklı nokta sayısı
  missed        jsonb not null default '[]'::jsonb, -- kapanışta atlanan noktaların adları
  check ((ended_at is null) = (end_kind is null))
);
create index if not exists patrol_tours_project_idx on public.patrol_tours (project_id, started_at desc);
create index if not exists patrol_tours_open_token_idx on public.patrol_tours (token_hash) where ended_at is null;
create index if not exists patrol_tours_open_idx on public.patrol_tours (last_scan_at) where ended_at is null;

alter table public.patrol_tours enable row level security;
drop policy if exists patrol_tours_read on public.patrol_tours;
create policy patrol_tours_read on public.patrol_tours for select to authenticated
  using (app.has_project_permission(project_id, 'patrol.read'));
drop policy if exists patrol_tours_delete on public.patrol_tours;
create policy patrol_tours_delete on public.patrol_tours for delete to authenticated
  using (app.has_global_permission('patrol.manage'));
revoke all on public.patrol_tours from anon;
grant select, delete on public.patrol_tours to authenticated;

alter table public.patrol_scans
  add column if not exists tour_id uuid references public.patrol_tours (id) on delete set null;
create index if not exists patrol_scans_tour_idx on public.patrol_scans (tour_id, scanned_at);

-- ---------- yardımcılar (yalnızca sunucu) ----------
-- turda okutulmamış (atlanan) aktif noktaların adları, sırayla
create or replace function app.patrol_missed(p_tour uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(pp.name order by pp.sort_order, pp.name), '[]'::jsonb)
    from public.patrol_tours t
    join public.patrol_points pp on pp.project_id = t.project_id and pp.kind = 'nokta' and pp.is_active
   where t.id = p_tour
     and not exists (select 1 from public.patrol_scans s where s.tour_id = t.id and s.point_id = pp.id);
$$;

-- turda okutulan farklı nokta sayısı (başlat/bitir etiketi sayılmaz)
create or replace function app.patrol_done(p_tour uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(distinct s.point_id)::integer
    from public.patrol_scans s
    join public.patrol_points pp on pp.id = s.point_id and pp.kind = 'nokta'
   where s.tour_id = p_tour;
$$;

-- turu kapatır: atlananlar ve sayılar o anda dondurulur
create or replace function app.patrol_close_tour(p_tour uuid, p_kind text, p_at timestamptz)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_missed jsonb := app.patrol_missed(p_tour);
  v_done   integer := app.patrol_done(p_tour);
begin
  update public.patrol_tours
     set ended_at = p_at, end_kind = p_kind, missed = v_missed, points_done = v_done,
         points_total = v_done + jsonb_array_length(v_missed)
   where id = p_tour and ended_at is null;
end;
$$;

-- son okutmadan 1 saat geçmiş açık turları "zaman aşımı" ile kapatır (p_project boşsa hepsi)
create or replace function app.patrol_close_stale(p_project uuid default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, last_scan_at from public.patrol_tours
     where ended_at is null and last_scan_at < now() - interval '1 hour'
       and (p_project is null or project_id = p_project)
  loop
    perform app.patrol_close_tour(r.id, 'zaman_asimi', r.last_scan_at + interval '1 hour');
  end loop;
end;
$$;

-- okutma satırı: konum (isteğe bağlı), noktanın konumunu ilk isabetli okutmadan öğrenme, uzaklık
create or replace function app.patrol_insert_scan(
  p_point uuid, p_tour uuid, p_personnel uuid,
  p_lat double precision, p_lng double precision, p_accuracy double precision, p_at timestamptz
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_point public.patrol_points;
  v_lat   double precision;
  v_lng   double precision;
  v_acc   integer;
  v_dist  integer;
begin
  select * into v_point from public.patrol_points where id = p_point;
  if p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_lat := p_lat;
    v_lng := p_lng;
    v_acc := case when p_accuracy is null or p_accuracy < 0 then null else least(round(p_accuracy), 100000)::integer end;
    if v_point.lat is null then
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
  insert into public.patrol_scans (project_id, point_id, personnel_id, tour_id, scanned_at, lat, lng, accuracy_m, distance_m)
  values (v_point.project_id, v_point.id, p_personnel, p_tour, p_at, v_lat, v_lng, v_acc, v_dist);
end;
$$;

-- telefonda gösterilecek tur özeti
create or replace function app.patrol_tour_summary(p_tour uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'person', t.person_name,
           'started_at', t.started_at,
           'ended_at', t.ended_at,
           'done', app.patrol_done(t.id),
           'missing', app.patrol_missed(t.id))
    from public.patrol_tours t where t.id = p_tour;
$$;

revoke execute on function app.new_patrol_code(), app.patrol_missed(uuid), app.patrol_done(uuid),
  app.patrol_close_tour(uuid, text, timestamptz), app.patrol_close_stale(uuid),
  app.patrol_insert_scan(uuid, uuid, uuid, double precision, double precision, double precision, timestamptz),
  app.patrol_tour_summary(uuid) from public, anon, authenticated;

-- ---------- okutma akışı (yalnızca sunucu çağırır; hatalar dönüş değeriyle) ----------

-- Her QR okutmasında ilk çağrı. Telefonun açık turu varsa:
--   nokta QR'ı  → okutma kaydedilir (state 'scanned')
--   başlat/bitir → durum döner, tur kapanmaz (state 'active'; bitirme ayrı çağrı)
-- Açık tur yoksa: başlat/bitir → 'start' (PIN sorulacak); nokta → 'no_tour' (kayıt yok).
create or replace function public.patrol_tour_scan(
  p_code       text,
  p_token_hash text,
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_accuracy   double precision default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_point   public.patrol_points;
  v_tour    public.patrol_tours;
  v_project text;
  v_now     timestamptz := now();
  v_last    timestamptz;
  v_repeat  boolean;
  v_base    jsonb;
begin
  select * into v_point from public.patrol_points where code = upper(btrim(p_code)) and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Bu QR kodu tanınmadı veya devre dışı bırakılmış.');
  end if;
  select name into v_project from public.projects where id = v_point.project_id;
  v_base := jsonb_build_object('ok', true, 'point', v_point.name, 'project', v_project, 'kind', v_point.kind);

  perform app.patrol_close_stale(v_point.project_id);

  if coalesce(p_token_hash, '') <> '' then
    select * into v_tour from public.patrol_tours
     where token_hash = p_token_hash and ended_at is null and project_id = v_point.project_id
     order by started_at desc limit 1;
  end if;

  if v_point.kind = 'tur' then
    if v_tour.id is null then
      return v_base || jsonb_build_object('state', 'start');
    end if;
    return v_base || jsonb_build_object('state', 'active', 'tour', app.patrol_tour_summary(v_tour.id));
  end if;

  if v_tour.id is null then
    return v_base || jsonb_build_object('state', 'no_tour');
  end if;

  -- aynı nokta 60 sn içinde yeniden gelirse (sayfa yenileme, çift okutma) yeni satır açılmaz
  select max(scanned_at) into v_last from public.patrol_scans
   where tour_id = v_tour.id and point_id = v_point.id and scanned_at > v_now - interval '60 seconds';
  if v_last is not null then
    return v_base || jsonb_build_object('state', 'scanned', 'scanned_at', v_last, 'duplicate', true, 'repeat', false,
                                        'tour', app.patrol_tour_summary(v_tour.id));
  end if;

  v_repeat := exists (select 1 from public.patrol_scans where tour_id = v_tour.id and point_id = v_point.id);
  perform app.patrol_insert_scan(v_point.id, v_tour.id, v_tour.personnel_id, p_lat, p_lng, p_accuracy, v_now);
  update public.patrol_tours set last_scan_at = v_now, points_done = app.patrol_done(v_tour.id) where id = v_tour.id;

  return v_base || jsonb_build_object('state', 'scanned', 'scanned_at', v_now, 'duplicate', false, 'repeat', v_repeat,
                                      'tour', app.patrol_tour_summary(v_tour.id));
end;
$$;

-- Turu başlatır: yalnızca başlat/bitir QR'ında, proje PIN'i + bugün projede çalışan personel ile.
create or replace function public.patrol_tour_start(
  p_code         text,
  p_pin          text,
  p_personnel_id uuid,
  p_token_hash   text,
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
  v_name     text;
  v_today    date := (now() at time zone 'Europe/Istanbul')::date;
  v_now      timestamptz := now();
  v_tour     uuid;
  r          record;
begin
  if coalesce(p_token_hash, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Telefon tanınamadı. Sayfayı yenileyip tekrar deneyin.');
  end if;
  select v.v_point_id, v.v_error into v_point_id, v_error from app.patrol_verify(p_code, p_pin) v;
  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', v_error);
  end if;
  select * into v_point from public.patrol_points where id = v_point_id;
  if v_point.kind <> 'tur' then
    return jsonb_build_object('ok', false, 'error', 'Devriye yalnızca “Devriye başlat / bitir” QR''ından başlatılır.');
  end if;

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

  perform app.patrol_close_stale(v_point.project_id);
  -- aynı kişinin (bu projede) ya da aynı telefonun açık turu varsa yeni tur onu kapatır
  for r in
    select id from public.patrol_tours
     where ended_at is null
       and ((project_id = v_point.project_id and personnel_id = p_personnel_id) or token_hash = p_token_hash)
  loop
    perform app.patrol_close_tour(r.id, 'yeni_tur', v_now);
  end loop;

  insert into public.patrol_tours (project_id, personnel_id, person_name, token_hash, started_at, last_scan_at, points_total)
  values (v_point.project_id, p_personnel_id, v_name, p_token_hash, v_now, v_now,
          (select count(*) from public.patrol_points where project_id = v_point.project_id and kind = 'nokta' and is_active))
  returning id into v_tour;
  perform app.patrol_insert_scan(v_point.id, v_tour, p_personnel_id, p_lat, p_lng, p_accuracy, v_now);

  return jsonb_build_object('ok', true, 'state', 'started', 'point', v_point.name, 'project', v_project, 'kind', 'tur',
                            'scanned_at', v_now, 'tour', app.patrol_tour_summary(v_tour));
end;
$$;

-- Turu bitirir: başlat/bitir QR'ında, telefonun açık turu için. Atlanan noktalar döner.
create or replace function public.patrol_tour_end(
  p_code       text,
  p_token_hash text,
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_accuracy   double precision default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_point   public.patrol_points;
  v_tour    public.patrol_tours;
  v_project text;
  v_now     timestamptz := now();
begin
  select * into v_point from public.patrol_points where code = upper(btrim(p_code)) and is_active and kind = 'tur';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Devriye yalnızca “Devriye başlat / bitir” QR''ında bitirilir.');
  end if;
  select name into v_project from public.projects where id = v_point.project_id;
  perform app.patrol_close_stale(v_point.project_id);
  select * into v_tour from public.patrol_tours
   where token_hash = p_token_hash and coalesce(p_token_hash, '') <> '' and ended_at is null and project_id = v_point.project_id
   order by started_at desc limit 1;
  if v_tour.id is null then
    return jsonb_build_object('ok', false, 'error', 'Bu telefonda açık devriye yok (bir saat içinde okutma yapılmadıysa kendiliğinden kapanır).');
  end if;

  perform app.patrol_insert_scan(v_point.id, v_tour.id, v_tour.personnel_id, p_lat, p_lng, p_accuracy, v_now);
  perform app.patrol_close_tour(v_tour.id, 'bitti', v_now);

  return jsonb_build_object('ok', true, 'state', 'ended', 'point', v_point.name, 'project', v_project, 'kind', 'tur',
                            'scanned_at', v_now, 'tour', app.patrol_tour_summary(v_tour.id));
end;
$$;

-- Telefon turu "unuttuysa" (çerez silindi, başka tarayıcı açıldı): PIN + ad ile kişinin AÇIK turu bu telefona
-- bağlanır ve okutma normal akışla işlenir. Açık turu yoksa kayıt yapılmaz.
create or replace function public.patrol_tour_resume(
  p_code         text,
  p_pin          text,
  p_personnel_id uuid,
  p_token_hash   text,
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
  v_tour     uuid;
begin
  if coalesce(p_token_hash, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Telefon tanınamadı. Sayfayı yenileyip tekrar deneyin.');
  end if;
  select v.v_point_id, v.v_error into v_point_id, v_error from app.patrol_verify(p_code, p_pin) v;
  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', v_error);
  end if;
  select * into v_point from public.patrol_points where id = v_point_id;
  perform app.patrol_close_stale(v_point.project_id);
  select id into v_tour from public.patrol_tours
   where project_id = v_point.project_id and personnel_id = p_personnel_id and ended_at is null
   order by started_at desc limit 1;
  if v_tour is null then
    return jsonb_build_object('ok', false, 'error', 'Açık devriyeniz yok. Önce “Devriye başlat / bitir” QR''ını okutup devriyeyi başlatın.');
  end if;
  update public.patrol_tours set token_hash = p_token_hash where id = v_tour;
  return public.patrol_tour_scan(p_code, p_token_hash, p_lat, p_lng, p_accuracy);
end;
$$;

revoke execute on function
  public.patrol_tour_scan(text, text, double precision, double precision, double precision),
  public.patrol_tour_start(text, text, uuid, text, double precision, double precision, double precision),
  public.patrol_tour_end(text, text, double precision, double precision, double precision),
  public.patrol_tour_resume(text, text, uuid, text, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function
  public.patrol_tour_scan(text, text, double precision, double precision, double precision),
  public.patrol_tour_start(text, text, uuid, text, double precision, double precision, double precision),
  public.patrol_tour_end(text, text, double precision, double precision, double precision),
  public.patrol_tour_resume(text, text, uuid, text, double precision, double precision, double precision)
  to service_role;

-- Eski tek adımlı okutma fonksiyonu (record_patrol_scan_pin) bilerek bırakıldı: yeni sürüm yayına girene kadar
-- canlıdaki eski ekran onu çağırır. Yeni kod kullanmaz; sonraki bir temizlikte kaldırılabilir.

-- ---------- gece temizliği: zaman aşımı + 1 aydan eski tur ve okutmalar ----------
create or replace function public.purge_old_patrol_data()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.patrol_close_stale(null);
  delete from public.patrol_scans        where scanned_at < now() - interval '1 month';
  delete from public.patrol_tours        where started_at < now() - interval '1 month';
  delete from public.patrol_pin_failures where created_at < now() - interval '1 day';
end;
$$;
revoke execute on function public.purge_old_patrol_data() from public, anon, authenticated;
grant  execute on function public.purge_old_patrol_data() to service_role;

update public.app_modules
   set description = 'Devriye turu: başlat/bitir QR''ı + proje PIN''i ile başlar, noktalar okutulur, bitirilir; atlanan noktalar raporlanır (kayıtlar 1 ay)'
 where code = 'devriye';
