import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TOUR_COLUMNS, dayRange, tourStatus,
  type PatrolPoint, type PatrolScanRow, type PatrolTour, type TourReport, type TourReportTour, type TourStatus,
} from "@/lib/patrol";

/** Oturumlu (RLS) ya da yönetici istemci; ikisi de aynı sorgu arayüzünü kullanır. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type TourFilter = { projectId?: string | null; from: string; to: string; status?: TourStatus | null; person?: string | null };

/** Bir tura ait okutma satırı (veritabanından). */
export type TourScanRaw = { id: string; tour_id: string; point_id: string; scanned_at: string; lat: number | null; lng: number | null; distance_m: number | null; accuracy_m: number | null };
export const TOUR_SCAN_COLUMNS = "id, tour_id, point_id, scanned_at, lat, lng, distance_m, accuracy_m";

const CHUNK = 1000; // PostgREST tek yanıtta en fazla bu kadar satır döndürür

/** Sayfa sayfa (1000'er) okuyarak tüm satırları toplar; aralıklar en fazla 1 aylık veri olduğu için sınırlıdır. */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 100 * CHUNK; from += CHUNK) {
    const { data, error } = await page(from, from + CHUNK - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < CHUNK) break;
  }
  return out;
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Filtreli tur sorgusu: başlangıcı [from, to) aralığında olan turlar, en yeni üstte.
 * Durum filtresi tourStatus() ile aynı kuralı izler.
 */
export function toursQuery(db: Db, columns: string, f: TourFilter, count = false) {
  let q = db.from("patrol_tours").select(columns, count ? { count: "exact" } : undefined).gte("started_at", f.from).lt("started_at", f.to);
  if (f.projectId) q = q.eq("project_id", f.projectId);
  if (f.person) q = q.ilike("person_name", `%${likeEscape(f.person)}%`);
  if (f.status === "devam") q = q.is("ended_at", null);
  else if (f.status === "tamam") q = q.eq("end_kind", "bitti").eq("missed", "[]");
  else if (f.status === "eksik") q = q.eq("end_kind", "bitti").neq("missed", "[]");
  else if (f.status) q = q.eq("end_kind", f.status);
  return q.order("started_at", { ascending: false }).order("id");
}

/** Verilen turların okutmaları, zaman sırasıyla (id listesi parçalanarak sorgulanır). */
export async function scansOfTours(db: Db, tourIds: string[]): Promise<TourScanRaw[]> {
  const out: TourScanRaw[] = [];
  for (let i = 0; i < tourIds.length; i += 150) {
    const ids = tourIds.slice(i, i + 150);
    out.push(...(await fetchAll<TourScanRaw>((a, b) => db.from("patrol_scans").select(TOUR_SCAN_COLUMNS).in("tour_id", ids).order("scanned_at").order("id").range(a, b))));
  }
  return out.sort((a, b) => a.scanned_at.localeCompare(b.scanned_at));
}

const asTour = (r: Record<string, unknown>): PatrolTour => ({ ...(r as PatrolTour), missed: Array.isArray(r.missed) ? (r.missed as string[]) : [] });
export const asTours = (rows: unknown[] | null | undefined): PatrolTour[] => ((rows ?? []) as Record<string, unknown>[]).map(asTour);

/**
 * Turu okutmalarıyla birleştirir. Kapanmış turda sayılar ve atlananlar veritabanında dondurulmuş haliyle,
 * açık turda projenin aktif noktalarına göre canlı hesaplanır. Başlat/bitir etiketindeki ilk okutma "start", sonrakiler "end".
 */
export function assembleTour(t: PatrolTour, scans: TourScanRaw[], active: { id: string; name: string }[], tourPointIds: Set<string>): TourReportTour {
  let sawStart = false;
  const rows = scans.map((s) => {
    let mark: "start" | "end" | undefined;
    if (tourPointIds.has(s.point_id)) {
      mark = sawStart ? "end" : "start";
      sawStart = true;
    }
    return { id: s.id, point_id: s.point_id, scanned_at: s.scanned_at, by: t.person_name, lat: s.lat, lng: s.lng, distance_m: s.distance_m, accuracy_m: s.accuracy_m, mark };
  });
  const status = tourStatus(t);
  if (status !== "devam") return { ...t, status, done: t.points_done, total: t.points_total, missing: t.missed, scans: rows };
  const seen = new Set(scans.map((s) => s.point_id));
  const done = active.filter((p) => seen.has(p.id)).length;
  return { ...t, status, done, total: active.length, missing: active.filter((p) => !seen.has(p.id)).map((p) => p.name), scans: rows };
}

/**
 * Bir projenin tur raporu (PDF için): [start, end] günlerinde başlayan turlar okutmalarıyla, aktif noktalar
 * ve tura bağlı olmayan eski okutmalar. Yetki kontrolü çağıranın sorumluluğundadır (patrol.read doğrulandıktan sonra).
 */
export async function loadTourReport(projectId: string, start: string, end: string, filters: TourReport["filters"]): Promise<TourReport | null> {
  const admin = createAdminClient();
  // zaman aşımına uğramış açık turlar kapansın (durumlar doğru görünsün)
  await admin.rpc("purge_old_patrol_data");
  const from = dayRange(start).from;
  const to = dayRange(end).to;
  const [{ data: project }, { data: points }, tourRows, legacyRaw] = await Promise.all([
    admin.from("projects").select("id, name, organizations(name)").eq("id", projectId).maybeSingle(),
    admin.from("patrol_points").select("id, name, code, sort_order, is_active, kind").eq("project_id", projectId).order("sort_order").order("name"),
    fetchAll<Record<string, unknown>>((a, b) => toursQuery(admin, TOUR_COLUMNS, { projectId, from, to, ...filters }).range(a, b)),
    fetchAll<{ id: string; point_id: string; scanned_at: string; scanned_by: string | null; personnel_id: string | null; lat: number | null; lng: number | null; distance_m: number | null; accuracy_m: number | null }>((a, b) =>
      admin.from("patrol_scans").select("id, point_id, scanned_at, scanned_by, personnel_id, lat, lng, distance_m, accuracy_m")
        .eq("project_id", projectId).is("tour_id", null).gte("scanned_at", from).lt("scanned_at", to).order("scanned_at").order("id").range(a, b)),
  ]);
  if (!project) return null;

  const all = (points ?? []) as (PatrolPoint & { kind: string })[];
  const checkpoints = all.filter((p) => p.kind !== "tur");
  const active = checkpoints.filter((p) => p.is_active);
  const tourPointIds = new Set(all.filter((p) => p.kind === "tur").map((p) => p.id));

  const tours = asTours(tourRows).reverse(); // PDF'te kronolojik
  const scans = await scansOfTours(admin, tours.map((t) => t.id));
  const byTour = new Map<string, TourScanRaw[]>();
  for (const s of scans) byTour.set(s.tour_id, [...(byTour.get(s.tour_id) ?? []), s]);

  const names = await scannerNames(legacyRaw);
  const legacy: PatrolScanRow[] = legacyRaw.map((s) => ({ id: s.id, point_id: s.point_id, scanned_at: s.scanned_at, by: names(s), lat: s.lat, lng: s.lng, distance_m: s.distance_m, accuracy_m: s.accuracy_m }));
  // Pasife alınmış bir nokta aralıkta okutulduysa adı yine çözülebilsin
  const used = new Set([...scans.map((s) => s.point_id), ...legacy.map((s) => s.point_id)]);

  const org = (project as unknown as { organizations: { name: string } | null }).organizations;
  return {
    project: { id: project.id as string, name: project.name as string, organization: org?.name ?? null },
    start,
    end,
    filters,
    points: checkpoints.filter((p) => p.is_active || used.has(p.id)).map(({ id, name, code, sort_order, is_active }) => ({ id, name, code, sort_order, is_active })),
    tours: tours.map((t) => assembleTour(t, byTour.get(t.id) ?? [], active, tourPointIds)),
    legacy,
    pointNames: Object.fromEntries(all.map((p) => [p.id, p.name])),
  };
}

/**
 * Okutanın adı: PIN ile okutmada personel; eski (giriş yaparak) okutmalarda kullanıcı hesabı.
 * Müşteri personel tablosunu her zaman göremeyebileceği için yönetici istemciyle çözülür; çağıran yetkiyi doğrulamış olmalı.
 */
export async function scannerNames(scans: { personnel_id?: unknown; scanned_by?: unknown }[]): Promise<(s: { personnel_id?: unknown; scanned_by?: unknown }) => string> {
  const admin = createAdminClient();
  const ids = (k: "personnel_id" | "scanned_by") => [...new Set(scans.map((s) => s[k]).filter((v): v is string => typeof v === "string"))];
  const pIds = ids("personnel_id");
  const uIds = ids("scanned_by");
  const [{ data: people }, { data: profs }] = await Promise.all([
    pIds.length ? admin.from("personnel").select("id, full_name").in("id", pIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    uIds.length ? admin.from("profiles").select("id, full_name").in("id", uIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const p = new Map((people ?? []).map((r) => [r.id as string, r.full_name as string]));
  const u = new Map((profs ?? []).map((r) => [r.id as string, r.full_name as string]));
  return (s) => (typeof s.personnel_id === "string" && p.get(s.personnel_id)) || (typeof s.scanned_by === "string" && u.get(s.scanned_by)) || "—";
}
