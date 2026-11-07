import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayRange, type DailyReport, type PatrolPoint, type PatrolScanRow } from "@/lib/patrol";

/**
 * Bir projenin bir günlük devriye raporunun verisi. Yetki kontrolü çağıranın sorumluluğundadır
 * (rapor yetkisi doğrulandıktan sonra çağrılır); okutanların adları için yönetici istemci kullanılır.
 */
export async function loadDailyReport(projectId: string, date: string): Promise<DailyReport | null> {
  const admin = createAdminClient();
  const { from, to } = dayRange(date);

  const [{ data: project }, { data: points }, { data: scans }] = await Promise.all([
    admin.from("projects").select("id, name, organizations(name)").eq("id", projectId).maybeSingle(),
    admin.from("patrol_points").select("id, name, code, sort_order, is_active").eq("project_id", projectId).order("sort_order").order("name"),
    admin.from("patrol_scans").select("id, point_id, scanned_at, scanned_by, personnel_id, lat, lng, distance_m").eq("project_id", projectId).gte("scanned_at", from).lt("scanned_at", to).order("scanned_at").limit(5000),
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
  }));
  const used = new Set(scanRows.map((s) => s.point_id));
  // Pasife alınmış bir nokta o gün okutulduysa raporda yine görünür
  const reportPoints = ((points ?? []) as PatrolPoint[]).filter((p) => p.is_active || used.has(p.id));

  return { project: { id: project.id as string, name: project.name as string, organization: org?.name ?? null }, date, points: reportPoints, scans: scanRows };
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
