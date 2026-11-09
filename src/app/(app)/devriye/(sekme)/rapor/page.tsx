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

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Bugünden `n` gün önce (Türkiye saatiyle, YYYY-AA-GG). */
const daysAgo = (n: number) => istanbulDay(new Date(Date.now() - n * 86400000));

/**
 * Devriye kayıtları: sayfa her açıldığında güncel kayıtlar veritabanından okunur (en yeni üstte).
 * Kayıtlar 1 ay saklanır; başlangıç–bitiş tarih aralığı seçilir (varsayılan bugün).
 * Altta proje ve gün bazında günlük raporlar (PDF).
 */
export default async function PatrolRecordsPage({ searchParams }: PageProps<"/devriye/rapor">) {
  await requireAccess("devriye", "patrol.read");
  // pg_cron yoksa yedek: 1 aydan eski kayıtları sayfa yanıtı gittikten sonra temizle
  after(async () => {
    await createAdminClient().rpc("purge_old_patrol_data");
  });

  const sp = await searchParams;
  const today = daysAgo(0);
  const oldest = daysAgo(PATROL_KEEP_DAYS - 1);
  // Tarih aralığı: boş/geçersizse bugün; saklama süresinin dışına taşmaz; ters girilirse yer değiştirir
  const pick = (v: string | undefined, fallback: string) => (v && DAY.test(v) ? (v < oldest ? oldest : v > today ? today : v) : fallback);
  let start = pick(str1(sp.bas), today);
  let end = pick(str1(sp.bit), str1(sp.bas) && DAY.test(str1(sp.bas)!) ? start : today);
  if (start > end) [start, end] = [end, start];
  const oneDay = start === end;
  const projectId = str1(sp.proje);
  const paging = pagingFrom(sp, PAGE);

  const range = { from: dayRange(start).from, to: dayRange(end).to };
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
    supabase.from("patrol_points").select("id, project_id, name, is_active").order("sort_order").order("name"),
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
  // seçili projede her aktif noktanın bu aralıktaki okutma sayısı ve son okutması (okutulmayan nokta hemen görünsün)
  const perPoint = new Map<string, { count: number; last: string }>();
  for (const s of (all ?? []) as Pick<Scan, "point_id" | "scanned_at">[]) {
    const e = perPoint.get(s.point_id) ?? { count: 0, last: s.scanned_at };
    e.count++;
    if (s.scanned_at > e.last) e.last = s.scanned_at;
    perPoint.set(s.point_id, e);
  }
  const pointSummary = isUuid(projectId)
    ? (points ?? []).filter((p) => p.project_id === projectId && p.is_active).map((p) => ({ id: p.id as string, name: p.name as string, ...(perPoint.get(p.id as string) ?? { count: 0, last: null }) }))
    : [];
  const missed = pointSummary.filter((p) => p.count === 0).length;

  const reports = [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || (projectName.get(a.project) ?? "").localeCompare(projectName.get(b.project) ?? "", "tr"));
  const pdfHref = (g: Group) => `/api/patrol/report?proje=${g.project}&tarih=${g.date}`;

  const fields: FilterField[] = [
    { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.filter((p) => withPoints.has(p.id)).map((p) => ({ value: p.id, label: p.name })) },
    { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange", value: start, valueTo: end, min: oldest, max: today },
  ];
  const showProject = !isUuid(projectId);

  const title = oneDay
    ? start === today ? "Bugünkü okutmalar" : fmtDayLong(start)
    : `${fmtDay(start)} – ${fmtDay(end)} okutmaları`;

  return (
    <>
      <FilterBar action={PATH} fields={fields} />

      {pointSummary.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title="Nokta durumu"
            description={missed ? `${pointSummary.length} noktadan ${missed} tanesi bu aralıkta hiç okutulmadı.` : `${pointSummary.length} noktanın hepsi bu aralıkta en az bir kez okutuldu.`}
          />
          <ul className="grid gap-2 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-3">
            {pointSummary.map((p) => (
              <li key={p.id} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2", p.count ? "border-border" : "border-danger/40 bg-danger-soft")}>
                <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                <span className={cn("shrink-0 text-right text-xs tabular-nums", p.count ? "text-muted" : "font-medium text-danger")}>
                  {p.count ? <>{p.count} okutma · son {oneDay ? fmtClock(p.last!, false) : `${fmtDay(istanbulDay(p.last!))} ${fmtClock(p.last!, false)}`}</> : "Okutulmadı"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title={title} description={`${total} okutma · en yeni üstte · kayıtlar ${PATROL_KEEP_DAYS} gün saklanır`} />
        {scans.length === 0 ? (
          <EmptyState title="Okutma kaydı yok" description={oneDay ? "Bu gün için devriye okutması yapılmamış." : "Seçilen tarih aralığında devriye okutması yapılmamış."} />
        ) : (
          <Table head={[oneDay ? "Saat" : "Tarih ve saat", "Nokta", "Personel", ...(showProject ? ["Proje"] : []), "Konum"]}>
            {scans.map((s) => {
              const loc = locationLabel(s);
              return (
                <tr key={s.id}>
                  <td className={cn(td, "whitespace-nowrap font-medium tabular-nums")}>
                    {!oneDay && <span className="mr-2 text-muted">{fmtDay(istanbulDay(s.scanned_at))}</span>}
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
