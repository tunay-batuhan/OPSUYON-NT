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
    admin.from("patrol_scans").select("id, point_id, scanned_at, scanned_by").eq("project_id", projectId).gte("scanned_at", from).lt("scanned_at", to).order("scanned_at").limit(5000),
  ]);
  if (!project) return null;

  const ids = [...new Set((scans ?? []).map((s) => s.scanned_by).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profs ?? []) names.set(p.id as string, p.full_name as string);
  }

  const org = (project as unknown as { organizations: { name: string } | null }).organizations;
  const scanRows: PatrolScanRow[] = (scans ?? []).map((s) => ({
    id: s.id as string,
    point_id: s.point_id as string,
    scanned_at: s.scanned_at as string,
    scanned_by: (s.scanned_by as string | null) ?? null,
    by: s.scanned_by ? (names.get(s.scanned_by as string) ?? "—") : "—",
  }));
  const used = new Set(scanRows.map((s) => s.point_id));
  // Pasife alınmış bir nokta o gün okutulduysa raporda yine görünür
  const reportPoints = ((points ?? []) as PatrolPoint[]).filter((p) => p.is_active || used.has(p.id));

  return { project: { id: project.id as string, name: project.name as string, organization: org?.name ?? null }, date, points: reportPoints, scans: scanRows };
}
