import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronDown, FileDown } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, btn, cn, td, tdNum } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireAccess } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scannerNames } from "@/lib/patrol-report";
import { PATROL_KEEP_DAYS, dayRange, eachDay, fmtClock, fmtDay, fmtDayLong, istanbulDay, locationLabel, mapsUrl } from "@/lib/patrol";

export const metadata: Metadata = { title: "Devriye Kayıtları" };

const PATH = "/devriye/rapor";
const PAGE = 25;
/** Gün kartı içinde açılan okutma listesi en fazla bu kadar satır gösterir; fazlası için günün kendi sayfası. */
const DAY_PREVIEW = 150;

type Scan = { id: string; project_id: string; point_id: string; scanned_at: string; personnel_id: string | null; scanned_by: string | null; lat: number | null; lng: number | null; distance_m: number | null; accuracy_m: number | null };
type PointRow = { id: string; project_id: string; name: string; is_active: boolean };
type DayState = "full" | "partial" | "none";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Bugünden `n` gün önce (Türkiye saatiyle, YYYY-AA-GG). */
const daysAgo = (n: number) => istanbulDay(new Date(Date.now() - n * 86400000));

const STATE: Record<DayState, { label: string; tone: "success" | "warning" | "danger"; bar: string }> = {
  full: { label: "Tam", tone: "success", bar: "bg-success" },
  partial: { label: "Eksik", tone: "warning", bar: "bg-warning" },
  none: { label: "Devriye yok", tone: "danger", bar: "bg-danger" },
};
const stateOf = (done: number, total: number, scans: number): DayState => (scans === 0 ? "none" : done < total ? "partial" : "full");

/** Konum hücresi: haritaya bağlantı, uzaksa kırmızı uyarı, yanında telefonun isabet payı. */
function LocationCell({ s }: { s: Scan }) {
  const loc = locationLabel(s);
  if (s.lat == null || s.lng == null) return <span className="text-muted">{loc.text}</span>;
  return (
    <a href={mapsUrl(s.lat, s.lng)} target="_blank" rel="noopener noreferrer" title={loc.hint} className={cn("inline-flex items-center gap-1 hover:underline", loc.far ? "font-medium text-danger" : "text-brand")}>
      {loc.far && <AlertTriangle className="size-3.5" aria-hidden />}
      {loc.text}
      {s.accuracy_m != null && <span className="text-xs font-normal text-muted">±{s.accuracy_m}</span>}
    </a>
  );
}

function ScanTable({ scans, oneDay, showProject, pointName, projectName, nameOf }: {
  scans: Scan[]; oneDay: boolean; showProject: boolean;
  pointName: Map<string, string>; projectName: Map<string, string>; nameOf: (s: Scan) => string;
}) {
  return (
    <Table head={[oneDay ? "Saat" : "Tarih ve saat", "Nokta", "Personel", ...(showProject ? ["Proje"] : []), "Konum"]}>
      {scans.map((s) => (
        <tr key={s.id}>
          <td className={cn(td, "whitespace-nowrap font-medium tabular-nums")}>
            {!oneDay && <span className="mr-2 text-muted">{fmtDay(istanbulDay(s.scanned_at))}</span>}
            {fmtClock(s.scanned_at)}
          </td>
          <td className={td}>{pointName.get(s.point_id) ?? "—"}</td>
          <td className={td}>{nameOf(s)}</td>
          {showProject && <td className={cn(td, "text-muted")}>{projectName.get(s.project_id) ?? "—"}</td>}
          <td className={cn(td, "whitespace-nowrap")}><LocationCell s={s} /></td>
        </tr>
      ))}
    </Table>
  );
}

/**
 * Devriye kayıtları: sayfa her açıldığında güncel kayıtlar veritabanından okunur.
 * Tek gün seçiliyse okutmalar saniyesiyle listelenir; birden çok gün seçiliyse her gün bir özet kartı olur
 * (kaç noktadan kaçı okutuldu, okutulmayanlar, gün PDF'i) ve aralığın tamamı tek PDF olarak indirilebilir.
 * Kayıtlar PATROL_KEEP_DAYS gün saklanır.
 */
export default async function PatrolRecordsPage({ searchParams }: PageProps<"/devriye/rapor">) {
  const user = await requireAccess("devriye", "patrol.read");
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
  const days = eachDay(start, end).reverse(); // en yeni üstte

  const supabase = await createClient();
  const [projects, { data: pointRows }] = await Promise.all([
    getAccessibleProjects(),
    supabase.from("patrol_points").select("id, project_id, name, is_active").order("sort_order").order("name"),
  ]);
  const points = (pointRows ?? []) as PointRow[];
  const withPoints = new Set(points.map((p) => p.project_id));
  const patrolProjects = projects.filter((p) => withPoints.has(p.id));
  // Müşterinin devriye yapılan tek projesi varsa seçtirmeye gerek yok: o proje kendiliğinden seçilir, filtre gizlenir
  const single = user.kind === "customer" && patrolProjects.length === 1 ? patrolProjects[0].id : null;
  const projectId = single ?? str1(sp.proje);
  const hasProject = isUuid(projectId);

  const range = { from: dayRange(start).from, to: dayRange(end).to };
  let q = supabase
    .from("patrol_scans")
    .select("id, project_id, point_id, scanned_at, personnel_id, scanned_by, lat, lng, distance_m, accuracy_m")
    .gte("scanned_at", range.from)
    .lt("scanned_at", range.to);
  if (hasProject) q = q.eq("project_id", projectId);
  const { data } = await q.order("scanned_at", { ascending: false }).limit(10000);
  const all = (data ?? []) as Scan[];
  const nameOf = await scannerNames(all);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const pointName = new Map(points.map((p) => [p.id, p.name]));
  const activeByProject = new Map<string, PointRow[]>();
  for (const p of points) if (p.is_active) activeByProject.set(p.project_id, [...(activeByProject.get(p.project_id) ?? []), p]);
  // kartlarda görünen projeler: seçili proje ya da aktif noktası olan tüm erişilebilir projeler
  const shownProjects = (hasProject ? patrolProjects.filter((p) => p.id === projectId) : patrolProjects).filter((p) => (activeByProject.get(p.id)?.length ?? 0) > 0);

  // gün → proje → okutmalar (her iki görünümde de kullanılır)
  const byDay = new Map<string, Scan[]>();
  for (const s of all) {
    const k = istanbulDay(s.scanned_at);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const summarize = (scans: Scan[], pid: string) => {
    const active = activeByProject.get(pid) ?? [];
    const ids = new Set(scans.map((s) => s.point_id));
    const done = active.filter((p) => ids.has(p.id)).length;
    const missed = active.filter((p) => !ids.has(p.id)).map((p) => p.name);
    const first = scans.length ? scans[scans.length - 1].scanned_at : null; // all en yeni üstte sıralı
    const last = scans.length ? scans[0].scanned_at : null;
    return { total: active.length, done, missed, count: scans.length, first, last, state: stateOf(done, active.length, scans.length) };
  };

  // seçili projede nokta bazında özet (okutulmayan nokta hemen görünsün)
  const perPoint = new Map<string, { count: number; last: string; days: Set<string> }>();
  for (const s of all) {
    const e = perPoint.get(s.point_id) ?? { count: 0, last: s.scanned_at, days: new Set<string>() };
    e.count++;
    if (s.scanned_at > e.last) e.last = s.scanned_at;
    e.days.add(istanbulDay(s.scanned_at));
    perPoint.set(s.point_id, e);
  }
  const pointSummary = hasProject ? (activeByProject.get(projectId) ?? []).map((p) => ({ id: p.id, name: p.name, ...(perPoint.get(p.id) ?? { count: 0, last: null, days: new Set<string>() }) })) : [];
  const missedPoints = pointSummary.filter((p) => p.count === 0).length;

  const dayHref = (d: string, pid?: string) => `${PATH}?${new URLSearchParams({ ...(pid ? { proje: pid } : {}), bas: d, bit: d }).toString()}`;
  const dayPdf = (pid: string, d: string) => `/api/patrol/report?proje=${pid}&tarih=${d}`;
  const rangePdf = hasProject ? `/api/patrol/report?proje=${projectId}&bas=${start}&bit=${end}` : null;

  const fields: FilterField[] = [
    ...(single ? [] : [{ name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: patrolProjects.map((p) => ({ value: p.id, label: p.name })) }]),
    { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange", value: start, valueTo: end, min: oldest, max: today },
  ];
  const showProject = !hasProject;

  /* ---------- tek gün: ayrıntılı okutma listesi ---------- */
  if (oneDay) {
    const paging = pagingFrom(sp, PAGE);
    const total = all.length;
    const scans = all.slice(paging.from, paging.to + 1);
    if (paging.page > 1 && scans.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total, PAGE) : 1));
    const title = start === today ? "Bugünkü okutmalar" : fmtDayLong(start);
    const dayReports = shownProjects.map((p) => ({ project: p, ...summarize((byDay.get(start) ?? []).filter((s) => s.project_id === p.id), p.id) }));

    return (
      <>
        <FilterBar action={PATH} fields={fields} />

        {pointSummary.length > 0 && (
          <Card className="mb-6">
            <CardHeader
              title="Nokta durumu"
              description={missedPoints ? `${pointSummary.length} noktadan ${missedPoints} tanesi bu gün hiç okutulmadı.` : `${pointSummary.length} noktanın hepsi bu gün en az bir kez okutuldu.`}
              action={hasProject && total > 0 ? (
                <a href={dayPdf(projectId, start)} className={btn("secondary", "sm")}><FileDown className="size-4" aria-hidden /> Gün raporu PDF</a>
              ) : undefined}
            />
            <ul className="grid gap-2 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-3">
              {pointSummary.map((p) => (
                <li key={p.id} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2", p.count ? "border-border" : "border-danger/40 bg-danger-soft")}>
                  <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                  <span className={cn("shrink-0 text-right text-xs tabular-nums", p.count ? "text-muted" : "font-medium text-danger")}>
                    {p.count ? <>{p.count} okutma · son {fmtClock(p.last!, false)}</> : "Okutulmadı"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title={title} description={`${total} okutma · en yeni üstte · kayıtlar ${PATROL_KEEP_DAYS} gün saklanır`} />
          {scans.length === 0 ? (
            <EmptyState title="Okutma kaydı yok" description="Bu gün için devriye okutması yapılmamış." />
          ) : (
            <ScanTable scans={scans} oneDay showProject={showProject} pointName={pointName} projectName={projectName} nameOf={nameOf} />
          )}
          <Pagination path={PATH} searchParams={sp} total={total} size={PAGE} />
        </Card>

        {showProject && dayReports.length > 0 && (
          <Card className="mt-6">
            <CardHeader title="Proje bazında günlük rapor" description="Her proje için bu günün okutma kayıtlarından otomatik oluşur." />
            <Table numeric={[1, 2]} head={["Proje", "Okutulan nokta", "Okutma", "Saat aralığı", "Durum", ""]}>
              {dayReports.map(({ project: p, ...r }) => (
                <tr key={p.id}>
                  <td className={cn(td, "font-medium")}>{p.name}</td>
                  <td className={tdNum}>{r.done} / {r.total}</td>
                  <td className={tdNum}>{r.count}</td>
                  <td className={cn(td, "whitespace-nowrap text-muted")}>{r.first ? `${fmtClock(r.first, false)} – ${fmtClock(r.last!, false)}` : "—"}</td>
                  <td className={td}><Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge></td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    {r.count > 0 && (
                      <>
                        <a href={`${dayPdf(p.id, start)}&goster=1`} target="_blank" rel="noopener noreferrer" className="mr-2 text-sm font-medium text-brand hover:underline">Görüntüle</a>
                        <a href={dayPdf(p.id, start)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">PDF indir</a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        )}
      </>
    );
  }

  /* ---------- çok gün: günlük özet kartları ---------- */
  const rangeLabel = `${fmtDay(start)} – ${fmtDay(end)}`;
  const totalScans = all.length;
  const daysWithPatrol = days.filter((d) => (byDay.get(d)?.length ?? 0) > 0).length;

  return (
    <>
      <FilterBar action={PATH} fields={fields} />

      <Card className="mb-6">
        <CardHeader
          title={`${rangeLabel} · ${days.length} gün`}
          description={`${totalScans} okutma · ${daysWithPatrol} günde devriye yapıldı${days.length - daysWithPatrol ? ` · ${days.length - daysWithPatrol} günde hiç okutma yok` : ""} · kayıtlar ${PATROL_KEEP_DAYS} gün saklanır`}
          action={rangePdf ? (
            <span className="inline-flex items-center gap-2">
              <a href={`${rangePdf}&goster=1`} target="_blank" rel="noopener noreferrer" className={btn("secondary", "sm")}>Görüntüle</a>
              <a href={rangePdf} className={btn("primary", "sm")}><FileDown className="size-4" aria-hidden /> Aralık raporu PDF</a>
            </span>
          ) : (
            <span className="text-sm text-muted">Aralığın tamamı için PDF almak üzere bir proje seçin.</span>
          )}
        />
        {pointSummary.length > 0 && (
          <div className="p-5">
            <p className="mb-2 text-sm font-medium">
              Nokta durumu
              <span className="ml-2 font-normal text-muted">{missedPoints ? `${pointSummary.length} noktadan ${missedPoints} tanesi bu aralıkta hiç okutulmadı.` : `${pointSummary.length} noktanın hepsi en az bir kez okutuldu.`}</span>
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pointSummary.map((p) => {
                const skipped = days.length - p.days.size;
                return (
                  <li key={p.id} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2", p.count ? (skipped ? "border-warning/40" : "border-border") : "border-danger/40 bg-danger-soft")}>
                    <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                    <span className={cn("shrink-0 text-right text-xs tabular-nums", p.count ? (skipped ? "text-warning" : "text-muted") : "font-medium text-danger")}>
                      {p.count ? `${p.count} okutma · ${p.days.size}/${days.length} gün` : "Okutulmadı"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      {shownProjects.length === 0 ? (
        <Card><EmptyState title="Devriye noktası tanımlı proje yok" description="Noktalar ve PIN sekmesinden projeye nokta ekleyin." /></Card>
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const dayScans = byDay.get(d) ?? [];
            const perProject = shownProjects.map((p) => ({ project: p, ...summarize(dayScans.filter((s) => s.project_id === p.id), p.id) }));
            // günün genel durumu: en kötü projeye göre
            const worst: DayState = perProject.some((r) => r.state === "none") ? "none" : perProject.some((r) => r.state === "partial") ? "partial" : "full";
            const preview = dayScans.slice(0, DAY_PREVIEW);
            return (
              <Card key={d}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={dayHref(d, hasProject ? projectId : undefined)} className="text-base font-semibold hover:text-brand hover:underline">
                      {d === today ? `Bugün · ${fmtDayLong(d)}` : fmtDayLong(d)}
                    </Link>
                    <Badge tone={STATE[worst].tone}>{STATE[worst].label}</Badge>
                  </div>
                  <span className="text-sm text-muted tabular-nums">{dayScans.length} okutma</span>
                </div>

                <ul className={cn("divide-y divide-border border-t border-border", perProject.length > 1 && "bg-surface-2/30")}>
                  {perProject.map(({ project: p, ...r }) => {
                    const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                    return (
                      <li key={p.id} className="grid gap-x-6 gap-y-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            {!hasProject && <span className="truncate text-sm font-medium">{p.name}</span>}
                            <span className="text-sm tabular-nums">
                              <span className="font-semibold">{r.done} / {r.total}</span> <span className="text-muted">nokta okutuldu</span>
                              {r.count > 0 && <span className="text-muted"> · {r.count} okutma · {fmtClock(r.first!, false)} – {fmtClock(r.last!, false)}</span>}
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name}: noktaların %${pct}'i okutuldu`}>
                            <div className={cn("h-full rounded-full transition-[width]", STATE[r.state].bar)} style={{ width: `${pct}%` }} />
                          </div>
                          {r.missed.length > 0 && (
                            <p className="mt-1.5 text-xs text-danger">
                              <span className="font-medium">Okutulmadı:</span> {r.missed.slice(0, 6).join(", ")}{r.missed.length > 6 && ` +${r.missed.length - 6}`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 md:justify-end">
                          {r.count > 0 && (
                            <a href={dayPdf(p.id, d)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">
                              <FileDown className="size-4" aria-hidden /> Gün PDF
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {dayScans.length > 0 && (
                  <details className="group border-t border-border">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-2.5 text-sm text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                      Okutmaları göster ({dayScans.length})
                    </summary>
                    <ScanTable scans={preview} oneDay showProject={showProject} pointName={pointName} projectName={projectName} nameOf={nameOf} />
                    {dayScans.length > DAY_PREVIEW && (
                      <p className="px-5 py-3 text-sm text-muted">
                        İlk {DAY_PREVIEW} okutma gösterildi. <Link href={dayHref(d, hasProject ? projectId : undefined)} className="font-medium text-brand hover:underline">Günün tamamını aç</Link>
                      </p>
                    )}
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
