import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayRange, eachDay, istanbulDay, type DailyReport, type PatrolPoint, type PatrolScanRow, type RangeReport } from "@/lib/patrol";

type Loaded = { project: DailyReport["project"]; points: PatrolPoint[]; scans: PatrolScanRow[] };

/**
 * Bir projenin [from, to) aralığındaki devriye verisi. Yetki kontrolü çağıranın sorumluluğundadır
 * (rapor yetkisi doğrulandıktan sonra çağrılır); okutanların adları için yönetici istemci kullanılır.
 */
async function loadReportData(projectId: string, from: string, to: string): Promise<Loaded | null> {
  const admin = createAdminClient();
  const [{ data: project }, { data: points }, { data: scans }] = await Promise.all([
    admin.from("projects").select("id, name, organizations(name)").eq("id", projectId).maybeSingle(),
    admin.from("patrol_points").select("id, name, code, sort_order, is_active").eq("project_id", projectId).order("sort_order").order("name"),
    admin.from("patrol_scans").select("id, point_id, scanned_at, scanned_by, personnel_id, lat, lng, distance_m, accuracy_m").eq("project_id", projectId).gte("scanned_at", from).lt("scanned_at", to).order("scanned_at").limit(20000),
  ]);
  if (!project) return null;

  const names = await scannerNames(scans ?? []);
  const org = (project as unknown as { organizations: { name: string } | null }).organizations;
  const scanRows: PatrolScanRow[] = (scans ?? []).map((s) => ({
    id: s.id as string,
    point_id: s.point_id as string,
    scanned_at: s.scanned_at as string,
    by: names(s),
    lat: (s.lat as number | null) ?? null,
    lng: (s.lng as number | null) ?? null,
    distance_m: (s.distance_m as number | null) ?? null,
    accuracy_m: (s.accuracy_m as number | null) ?? null,
  }));
  const used = new Set(scanRows.map((s) => s.point_id));
  // Pasife alınmış bir nokta aralıkta okutulduysa raporda yine görünür
  const reportPoints = ((points ?? []) as PatrolPoint[]).filter((p) => p.is_active || used.has(p.id));

  return { project: { id: project.id as string, name: project.name as string, organization: org?.name ?? null }, points: reportPoints, scans: scanRows };
}

/** Bir günlük rapor verisi. */
export async function loadDailyReport(projectId: string, date: string): Promise<DailyReport | null> {
  const { from, to } = dayRange(date);
  const d = await loadReportData(projectId, from, to);
  return d && { project: d.project, date, points: d.points, scans: d.scans };
}

/** Tarih aralığı (haftalık / aylık) rapor verisi; aralıktaki her gün, okutma olmasa da yer alır. */
export async function loadRangeReport(projectId: string, start: string, end: string): Promise<RangeReport | null> {
  const d = await loadReportData(projectId, dayRange(start).from, dayRange(end).to);
  if (!d) return null;
  const byDay = new Map<string, PatrolScanRow[]>();
  for (const s of d.scans) {
    const k = istanbulDay(s.scanned_at);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  return { project: d.project, start, end, points: d.points, days: eachDay(start, end).map((date) => ({ date, scans: byDay.get(date) ?? [] })) };
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
