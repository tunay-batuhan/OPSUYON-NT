-- Devriye turu çerezsiz de bulunur (11 Kasım canlı test).
-- Sorun: bazı telefonların kamera / QR uygulaması her QR'ı hafızasız ayrı bir pencerede açar; turu başlatan
-- pencerenin çerezi nokta sayfasına gelmez ve nokta "Devriye başlatılmamış" der.
-- Kural:
--   1. Telefonun anahtarı (çerez) açık bir tura denk geliyorsa o tur.
--   2. Gelmiyorsa ve projede TEK açık tur varsa o tur (görevli telefonun kendi kamerasıyla okutmaya devam eder).
--   3. Projede birden fazla açık tur varsa görevli PIN + adıyla kendi turunu seçer.
-- Başlat/bitir etiketinde, çerez olmasa da projedeki tek açık tur gösterilir ve bitirilebilir.
-- Aynı kişi PIN + adla tekrar "başlat" derse açık turu kapanmaz, bu telefona bağlanır (devam eder).

create or replace function app.patrol_find_tour(
  p_project    uuid,
  p_token_hash text,
  out tour_id    uuid,
  out open_count int,
  out by_token   boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  by_token := false;
  if coalesce(p_token_hash, '') <> '' then
    select t.id into tour_id from public.patrol_tours t
     where t.token_hash = p_token_hash and t.ended_at is null and t.project_id = p_project
     order by t.started_at desc limit 1;
    by_token := tour_id is not null;
  end if;
  select count(*)::int into open_count from public.patrol_tours t where t.project_id = p_project and t.ended_at is null;
  if tour_id is null and open_count = 1 then
    select t.id into tour_id from public.patrol_tours t where t.project_id = p_project and t.ended_at is null;
  end if;
end;
$$;
revoke execute on function app.patrol_find_tour(uuid, text) from public, anon, authenticated;

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
  v_tour_id uuid;
  v_open    int;
  v_mine    boolean;
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

  select f.tour_id, f.open_count, f.by_token into v_tour_id, v_open, v_mine from app.patrol_find_tour(v_point.project_id, p_token_hash) f;
  if v_tour_id is not null then
    select * into v_tour from public.patrol_tours where id = v_tour_id;
  end if;

  if v_point.kind = 'tur' then
    if v_tour.id is null then
      return v_base || jsonb_build_object('state', 'start', 'open_tours', v_open);
    end if;
    return v_base || jsonb_build_object('state', 'active', 'tour_id', v_tour.id, 'mine', v_mine,
                                        'tour', app.patrol_tour_summary(v_tour.id));
  end if;

  if v_tour.id is null then
    return v_base || jsonb_build_object('state', 'no_tour', 'open_tours', v_open);
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

-- Başlat: aynı kişinin bu projede açık turu varsa yenisi açılmaz; o tur bu telefona bağlanır ve durumu döner.
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

  -- kişinin açık turu varsa: devam (bu telefona bağlanır), yeni tur açılmaz
  select id into v_tour from public.patrol_tours
   where project_id = v_point.project_id and personnel_id = p_personnel_id and ended_at is null
   order by started_at desc limit 1;
  if v_tour is not null then
    update public.patrol_tours set token_hash = p_token_hash where id = v_tour;
    return jsonb_build_object('ok', true, 'state', 'active', 'point', v_point.name, 'project', v_project, 'kind', 'tur',
                              'tour_id', v_tour, 'mine', true, 'tour', app.patrol_tour_summary(v_tour));
  end if;

  -- bu telefonun başka bir kişi adına açık turu varsa kapanır (telefon el değiştirdi)
  for r in select id from public.patrol_tours where ended_at is null and token_hash = p_token_hash loop
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

-- Bitir (yeni imza, p_tour_id ile): telefonun anahtarı açık tura denk geliyorsa o tur; gelmiyorsa ekranda gösterilen
-- tur (p_tour_id) — yalnızca projedeki TEK açık tursa. p_tour_id, gösterilen tur ile bitirilen turun aynı olmasını sağlar.
create or replace function public.patrol_tour_end(
  p_code       text,
  p_token_hash text,
  p_tour_id    uuid,
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
  v_tour_id uuid;
  v_mine    boolean;
  v_project text;
  v_now     timestamptz := now();
begin
  select * into v_point from public.patrol_points where code = upper(btrim(p_code)) and is_active and kind = 'tur';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Devriye yalnızca “Devriye başlat / bitir” QR''ında bitirilir.');
  end if;
  select name into v_project from public.projects where id = v_point.project_id;
  perform app.patrol_close_stale(v_point.project_id);

  select f.tour_id, f.by_token into v_tour_id, v_mine from app.patrol_find_tour(v_point.project_id, p_token_hash) f;
  -- anahtarla bulunmadıysa (tek açık tur) yalnızca ekranda gösterilen tur bitirilir
  if v_tour_id is not null and not v_mine and v_tour_id is distinct from p_tour_id then
    v_tour_id := null;
  end if;
  if v_tour_id is not null then
    select * into v_tour from public.patrol_tours where id = v_tour_id;
  end if;
  if v_tour.id is null then
    return jsonb_build_object('ok', false, 'error', 'Açık devriye bulunamadı (bir saat içinde okutma yapılmadıysa kendiliğinden kapanır). QR''ı yeniden okutun.');
  end if;

  perform app.patrol_insert_scan(v_point.id, v_tour.id, v_tour.personnel_id, p_lat, p_lng, p_accuracy, v_now);
  perform app.patrol_close_tour(v_tour.id, 'bitti', v_now);

  return jsonb_build_object('ok', true, 'state', 'ended', 'point', v_point.name, 'project', v_project, 'kind', 'tur',
                            'scanned_at', v_now, 'tour', app.patrol_tour_summary(v_tour.id));
end;
$$;

revoke execute on function public.patrol_tour_end(text, text, uuid, double precision, double precision, double precision) from public, anon, authenticated;
grant  execute on function public.patrol_tour_end(text, text, uuid, double precision, double precision, double precision) to service_role;
-- Eski patrol_tour_end(text, text, ...) imzası, yayındaki eski ekran için bırakıldı; yeni kod kullanmaz.
