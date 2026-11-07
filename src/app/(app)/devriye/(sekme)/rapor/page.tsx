import type { Metadata } from "next";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, EmptyState, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireAccess } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scannerNames } from "@/lib/patrol-report";
import { PATROL_KEEP_DAYS, dayRange, fmtClock, fmtDay, fmtDayLong, istanbulDay, locationLabel, mapsUrl } from "@/lib/patrol";

export const metadata: Metadata = { title: "Devriye Kayıtları" };

const PATH = "/devriye/rapor";
const PAGE = 25;

type Scan = { id: string; project_id: string; point_id: string; scanned_at: string; personnel_id: string | null; scanned_by: string | null; lat: number | null; lng: number | null; distance_m: number | null };

/** Son PATROL_KEEP_DAYS günün tarihleri (bugün başta), Türkiye saatiyle. */
function recentDays(): string[] {
  const now = Date.now();
  return Array.from({ length: PATROL_KEEP_DAYS }, (_, i) => istanbulDay(new Date(now - i * 86400000)));
}

/**
 * Devriye kayıtları: sayfa her açıldığında güncel kayıtlar veritabanından okunur (en yeni üstte).
 * Kayıtlar 1 ay saklanır; gün seçilir (varsayılan bugün) ya da son 1 ayın tamamı listelenir.
 * Altta proje ve gün bazında günlük raporlar (PDF).
 */
export default async function PatrolRecordsPage({ searchParams }: PageProps<"/devriye/rapor">) {
  await requireAccess("devriye", "patrol.read");
  // pg_cron yoksa yedek: 1 aydan eski kayıtları sayfa yanıtı gittikten sonra temizle
  after(async () => {
    await createAdminClient().rpc("purge_old_patrol_data");
  });

  const sp = await searchParams;
  const days = recentDays();
  const today = days[0];
  // "Son 1 ay" seçilince adreste gun= boş gelir; hiç gelmezse bugün
  const day = sp.gun === undefined ? today : (days.find((d) => d === str1(sp.gun)) ?? "");
  const projectId = str1(sp.proje);
  const paging = pagingFrom(sp, PAGE);

  const range = day ? dayRange(day) : { from: dayRange(days[days.length - 1]).from, to: dayRange(today).to };
  const supabase = await createClient();
  const projects = await getAccessibleProjects();

  let listQ = supabase
    .from("patrol_scans")
    .select("id, project_id, point_id, scanned_at, personnel_id, scanned_by, lat, lng, distance_m", { count: "exact" })
    .gte("scanned_at", range.from)
    .lt("scanned_at", range.to);
  let allQ = supabase.from("patrol_scans").select("project_id, point_id, scanned_at").gte("scanned_at", range.from).lt("scanned_at", range.to);
  if (isUuid(projectId)) {
    listQ = listQ.eq("project_id", projectId);
    allQ = allQ.eq("project_id", projectId);
  }
  const [{ data: list, count }, { data: all }, { data: points }] = await Promise.all([
    listQ.order("scanned_at", { ascending: false }).range(paging.from, paging.to),
    allQ.order("scanned_at").limit(10000),
    supabase.from("patrol_points").select("id, project_id, name, is_active"),
  ]);
  const scans = (list ?? []) as Scan[];
  const total = count ?? 0;
  if (paging.page > 1 && scans.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total, PAGE) : 1));

  const nameOf = await scannerNames(scans);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const pointName = new Map((points ?? []).map((p) => [p.id as string, p.name as string]));
  const activePoints = new Map<string, number>();
  const withPoints = new Set<string>();
  for (const p of points ?? []) {
    withPoints.add(p.project_id as string);
    if (p.is_active) activePoints.set(p.project_id as string, (activePoints.get(p.project_id as string) ?? 0) + 1);
  }

  // günlük raporlar: proje + gün
  type Group = { key: string; project: string; date: string; points: Set<string>; count: number; first: string; last: string };
  const groups = new Map<string, Group>();
  for (const s of (all ?? []) as Pick<Scan, "project_id" | "point_id" | "scanned_at">[]) {
    const date = istanbulDay(s.scanned_at);
    const key = `${s.project_id}|${date}`;
    const g = groups.get(key) ?? { key, project: s.project_id, date, points: new Set<string>(), count: 0, first: s.scanned_at, last: s.scanned_at };
    g.points.add(s.point_id);
    g.count++;
    g.last = s.scanned_at;
    groups.set(key, g);
  }
  const reports = [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || (projectName.get(a.project) ?? "").localeCompare(projectName.get(b.project) ?? "", "tr"));
  const pdfHref = (g: Group) => `/api/patrol/report?proje=${g.project}&tarih=${g.date}`;

  const fields: FilterField[] = [
    { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.filter((p) => withPoints.has(p.id)).map((p) => ({ value: p.id, label: p.name })) },
    { name: "gun", label: "Gün", value: day, all: "Son 1 ay", options: days.map((d) => ({ value: d, label: d === today ? `Bugün (${fmtDay(d)})` : fmtDayLong(d) })) },
  ];
  const showProject = !isUuid(projectId);

  return (
    <>
      <FilterBar action={PATH} fields={fields} />

      <Card>
        <CardHeader title={day ? (day === today ? "Bugünkü okutmalar" : fmtDayLong(day)) : "Son 1 ayın okutmaları"} description={`${total} okutma · en yeni üstte`} />
        {scans.length === 0 ? (
          <EmptyState title="Okutma kaydı yok" description={day ? "Bu gün için devriye okutması yapılmamış." : "Son 1 ayda devriye okutması yapılmamış."} />
        ) : (
          <Table head={[day ? "Saat" : "Tarih ve saat", "Nokta", "Personel", ...(showProject ? ["Proje"] : []), "Konum"]}>
            {scans.map((s) => {
              const loc = locationLabel(s);
              return (
                <tr key={s.id}>
                  <td className={cn(td, "whitespace-nowrap font-medium tabular-nums")}>
                    {!day && <span className="mr-2 text-muted">{fmtDay(istanbulDay(s.scanned_at))}</span>}
                    {fmtClock(s.scanned_at)}
                  </td>
                  <td className={td}>{pointName.get(s.point_id) ?? "—"}</td>
                  <td className={td}>{nameOf(s)}</td>
                  {showProject && <td className={cn(td, "text-muted")}>{projectName.get(s.project_id) ?? "—"}</td>}
                  <td className={cn(td, "whitespace-nowrap")}>
                    {s.lat != null && s.lng != null ? (
                      <a href={mapsUrl(s.lat, s.lng)} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 hover:underline", loc.far ? "font-medium text-danger" : "text-brand")}>
                        {loc.far && <AlertTriangle className="size-3.5" aria-hidden />}
                        {loc.text}
                      </a>
                    ) : (
                      <span className="text-muted">{loc.text}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        <Pagination path={PATH} searchParams={sp} total={total} size={PAGE} />
      </Card>

      <Card className="mt-6">
        <CardHeader title="Günlük raporlar" description="Her proje ve gün için okutma kayıtlarından otomatik oluşur." />
        {reports.length === 0 ? (
          <EmptyState title="Rapor yok" description="O gün hiç okutma yapılmadıysa rapor oluşmaz." />
        ) : (
          <Table numeric={[2, 3]} head={["Tarih", "Proje", "Okutulan nokta", "Okutma", "Saat aralığı", ""]}>
            {reports.map((g) => (
              <tr key={g.key}>
                <td className={cn(td, "font-medium")}>{fmtDay(g.date)}</td>
                <td className={td}>{projectName.get(g.project) ?? "—"}</td>
                <td className={tdNum}>{g.points.size} / {Math.max(activePoints.get(g.project) ?? 0, g.points.size)}</td>
                <td className={tdNum}>{g.count}</td>
                <td className={cn(td, "whitespace-nowrap text-muted")}>{fmtClock(g.first, false)} – {fmtClock(g.last, false)}</td>
                <td className={cn(td, "whitespace-nowrap text-right")}>
                  <a href={`${pdfHref(g)}&goster=1`} target="_blank" rel="noopener noreferrer" className="mr-2 text-sm font-medium text-brand hover:underline">Görüntüle</a>
                  <a href={pdfHref(g)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">PDF indir</a>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
