import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronDown, CircleCheck, FileDown, MapPinOff, Route, TriangleAlert } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Stat, Table, btn, cn, td, tdNum } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireAccess } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assembleTour, asTours, fetchAll, scannerNames, scansOfTours, toursQuery, type TourFilter, type TourScanRaw } from "@/lib/patrol-report";
import {
  PATROL_KEEP_DAYS, TOUR_COLUMNS, TOUR_STATUS, checkpointStats, dayRange, fmtClock, fmtDay, fmtDayLong, istanbulDay, isTourStatus,
  locationLabel, mapsUrl, scannedPointNames, tourDuration, tourStatus, type TourReportTour, type TourStatus,
} from "@/lib/patrol";

export const metadata: Metadata = { title: "Devriye Kayıtları" };

const PATH = "/devriye/rapor";
const PAGE = 10;
/** Tur dışı (eski sistem) okutmalardan en fazla bu kadarı listelenir. */
const LEGACY_LIMIT = 300;

type Scan = { id: string; project_id: string; point_id: string; scanned_at: string; personnel_id: string | null; scanned_by: string | null; lat: number | null; lng: number | null; distance_m: number | null; accuracy_m: number | null };
type PointRow = { id: string; project_id: string; name: string; is_active: boolean; kind: "nokta" | "tur" };
type SummaryRow = { id: string; project_id: string; end_kind: TourReportTour["end_kind"]; missed: unknown };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Bugünden `n` gün önce (Türkiye saatiyle, YYYY-AA-GG). */
const daysAgo = (n: number) => istanbulDay(new Date(Date.now() - n * 86400000));
/** Filtredeki durum seçenekleri (liste sırası) */
const STATUS_ORDER: TourStatus[] = ["tamam", "eksik", "zaman_asimi", "devam", "yeni_tur"];
const EMPTY_HELP = "Devriye, “Devriye başlat / bitir” QR'ı okutulunca başlar; turlar burada listelenir.";

/** Konum hücresi: haritaya bağlantı, uzaksa kırmızı uyarı, yanında telefonun isabet payı. */
function LocationCell({ s }: { s: Pick<Scan, "lat" | "lng" | "distance_m" | "accuracy_m"> }) {
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

/** Eski sistem (tura bağlı olmayan) okutmaların basit listesi. */
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

/** Tarih + saat (gün aynıysa yalnızca saat istenebilir). */
const dayClock = (ts: string) => `${fmtDay(istanbulDay(ts))} ${fmtClock(ts, false)}`;

/** Mobilde hücrenin üstünde görünen küçük etiket (geniş ekranda sütun başlığı var). */
function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 text-sm", className)}>
      <span className="block text-xs text-muted md:hidden">{label}</span>
      {children}
    </div>
  );
}

const GRID = "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,1.7fr)_minmax(0,0.9fr)]";

/** Bir tur: özet satırı (atlananlar dahil) ve açılınca okutmaları. */
function TourItem({ t, projectLabel, pointName }: { t: TourReportTour; projectLabel?: string; pointName: Map<string, string> }) {
  const st = TOUR_STATUS[t.status];
  const open = t.status === "devam";
  const ended = t.ended_at && istanbulDay(t.ended_at) !== istanbulDay(t.started_at) ? dayClock(t.ended_at) : t.ended_at ? fmtClock(t.ended_at, false) : null;
  const scannedNames = scannedPointNames(t, (id) => pointName.get(id));
  return (
    <li>
      <details className="group">
        <summary className={cn("grid cursor-pointer list-none grid-cols-2 gap-x-4 gap-y-2 px-5 py-3 hover:bg-surface-2/50 md:items-center [&::-webkit-details-marker]:hidden", GRID)}>
          <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
            <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
            <div className="min-w-0">
              <p className="truncate font-medium">{t.person_name}</p>
              {projectLabel && <p className="truncate text-xs text-muted">{projectLabel}</p>}
            </div>
          </div>
          <Cell label="Başlangıç" className="tabular-nums">{dayClock(t.started_at)}</Cell>
          <Cell label="Bitiş" className="tabular-nums">
            {t.status === "zaman_asimi" ? (
              <span className="text-danger">son okutma {fmtClock(t.last_scan_at, false)}</span>
            ) : open ? (
              <span className="text-muted">sürüyor</span>
            ) : (
              ended
            )}
          </Cell>
          <Cell label="Süre" className="tabular-nums">{tourDuration(t)}</Cell>
          <Cell label="Nokta" className={cn("tabular-nums", !open && t.missing.length > 0 && "font-medium text-warning")}>{t.done} / {t.total}</Cell>
          <Cell label="Nokta adı" className="col-span-2 leading-snug md:col-span-1">
            {scannedNames.length > 0 ? scannedNames.join(", ") : <span className="text-muted">—</span>}
          </Cell>
          <Cell label="Durum"><Badge tone={st.tone}>{st.label}</Badge></Cell>
          {t.missing.length > 0 && (
            <p className={cn("col-span-2 text-xs md:col-span-7 md:pl-6", open ? "text-muted" : t.status === "eksik" ? "text-warning" : "text-danger")}>
              <span className="font-medium">{open ? "Henüz okutulmayan" : "Atlanan"}:</span> {t.missing.join(", ")}
            </p>
          )}
        </summary>
        <div className="border-t border-border bg-surface-2/30">
          {t.scans.length === 0 ? (
            <p className="px-5 py-3 text-sm text-muted">Bu turda okutma kaydı yok.</p>
          ) : (
            <Table head={["Saat", "Nokta", "Konum"]}>
              {t.scans.map((s) => (
                <tr key={s.id}>
                  <td className={cn(td, "whitespace-nowrap font-medium tabular-nums")}>
                    {istanbulDay(s.scanned_at) !== istanbulDay(t.started_at) && <span className="mr-2 text-muted">{fmtDay(istanbulDay(s.scanned_at))}</span>}
                    {fmtClock(s.scanned_at)}
                  </td>
                  <td className={td}>
                    {s.mark ? <Badge tone={s.mark === "start" ? "brand" : "neutral"}>{s.mark === "start" ? "Başlangıç" : "Bitiş"}</Badge> : (pointName.get(s.point_id) ?? "—")}
                  </td>
                  <td className={cn(td, "whitespace-nowrap")}><LocationCell s={s} /></td>
                </tr>
              ))}
            </Table>
          )}
          {t.status === "zaman_asimi" && <p className="border-t border-border px-5 py-2.5 text-xs text-danger">Görevli turu bitirmedi; son okutmadan 1 saat sonra kendiliğinden kapandı.</p>}
          {t.status === "yeni_tur" && <p className="border-t border-border px-5 py-2.5 text-xs text-muted">Aynı görevli (ya da aynı telefon) yeni tur başlattığı için bu tur kapandı.</p>}
        </div>
      </details>
    </li>
  );
}

/**
 * Devriye kayıtları (tur tabanlı): görevli "Devriye başlat / bitir" QR'ını okutunca tur başlar, noktaları okutur, bitirir.
 * Liste seçili aralıkta başlayan turlardır (en yeni üstte, 10'ar); her tur açılınca okutmaları görünür.
 * Üstte aralığın özeti ve (proje seçiliyse) nokta bazında kaç turda atlandığı; tur sistemi öncesi okutmalar en altta.
 * Kayıtlar PATROL_KEEP_DAYS gün saklanır.
 */
export default async function PatrolRecordsPage({ searchParams }: PageProps<"/devriye/rapor">) {
  const user = await requireAccess("devriye", "patrol.read");
  // Okumadan önce: zaman aşımına uğramış açık turlar kapansın (durumlar doğru görünsün), 1 aydan eskiler silinsin
  await createAdminClient().rpc("purge_old_patrol_data");

  const sp = await searchParams;
  const today = daysAgo(0);
  const oldest = daysAgo(PATROL_KEEP_DAYS - 1);
  // Tarih aralığı: boş/geçersizse bugün; saklama süresinin dışına taşmaz; ters girilirse yer değiştirir
  const pick = (v: string | undefined, fallback: string) => (v && DAY.test(v) ? (v < oldest ? oldest : v > today ? today : v) : fallback);
  let start = pick(str1(sp.bas), today);
  let end = pick(str1(sp.bit), str1(sp.bas) && DAY.test(str1(sp.bas)!) ? start : today);
  if (start > end) [start, end] = [end, start];
  const oneDay = start === end;
  const durum = str1(sp.durum);
  const status = isTourStatus(durum) ? durum : null;
  const person = str1(sp.personel)?.trim().slice(0, 60) || null;

  const supabase = await createClient();
  const [projects, { data: pointRows }] = await Promise.all([
    getAccessibleProjects(),
    supabase.from("patrol_points").select("id, project_id, name, is_active, kind").order("sort_order").order("name"),
  ]);
  const points = (pointRows ?? []) as PointRow[];
  const checkpoints = points.filter((p) => p.kind !== "tur"); // başlat/bitir etiketi kontrol noktası sayılmaz
  const tourPointIds = new Set(points.filter((p) => p.kind === "tur").map((p) => p.id));
  const withPoints = new Set(checkpoints.map((p) => p.project_id));
  const patrolProjects = projects.filter((p) => withPoints.has(p.id));
  // Müşterinin devriye yapılan tek projesi varsa seçtirmeye gerek yok: o proje kendiliğinden seçilir, filtre gizlenir
  const single = user.kind === "customer" && patrolProjects.length === 1 ? patrolProjects[0].id : null;
  const projectId = single ?? str1(sp.proje);
  const hasProject = isUuid(projectId);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const pointName = new Map(points.map((p) => [p.id, p.name]));
  const activeByProject = new Map<string, PointRow[]>();
  for (const p of checkpoints) if (p.is_active) activeByProject.set(p.project_id, [...(activeByProject.get(p.project_id) ?? []), p]);
  // izlenen projeler: seçili proje ya da aktif noktası olan tüm erişilebilir projeler
  const shownProjects = (hasProject ? patrolProjects.filter((p) => p.id === projectId) : patrolProjects).filter((p) => (activeByProject.get(p.id)?.length ?? 0) > 0);

  const range = { from: dayRange(start).from, to: dayRange(end).to };
  const filter: TourFilter = { projectId: hasProject ? projectId : null, from: range.from, to: range.to, status, person };
  const paging = pagingFrom(sp, PAGE);
  // aralığın son gününde başlayıp gece yarısını geçen turların okutmaları da sayılsın
  const scanTo = new Date(Date.parse(range.to) + 86400000).toISOString();

  let legacyQ = supabase
    .from("patrol_scans")
    .select("id, project_id, point_id, scanned_at, personnel_id, scanned_by, lat, lng, distance_m, accuracy_m", { count: "exact" })
    .is("tour_id", null)
    .gte("scanned_at", range.from)
    .lt("scanned_at", range.to);
  if (hasProject) legacyQ = legacyQ.eq("project_id", projectId);

  const [list, summaryRows, pairs, legacyRes] = await Promise.all([
    toursQuery(supabase, TOUR_COLUMNS, filter, true).range(paging.from, paging.to),
    // özet: durum filtresinden bağımsız (tarih, proje, personel)
    fetchAll<SummaryRow>((a, b) => toursQuery(supabase, "id, project_id, end_kind, missed", { ...filter, status: null }).range(a, b)),
    // nokta durumu: seçili projede turlara bağlı okutmaların (tur, nokta) çiftleri
    hasProject
      ? fetchAll<Pick<TourScanRaw, "tour_id" | "point_id">>((a, b) =>
          supabase.from("patrol_scans").select("tour_id, point_id").eq("project_id", projectId).not("tour_id", "is", null)
            .gte("scanned_at", range.from).lt("scanned_at", scanTo).order("id").range(a, b))
      : Promise.resolve([]),
    legacyQ.order("scanned_at", { ascending: false }).limit(LEGACY_LIMIT),
  ]);
  if (list.error) throw list.error;

  const total = list.count ?? 0;
  const pageTours = asTours(list.data);
  if (paging.page > 1 && pageTours.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total, PAGE) : 1));
  const tourScans = await scansOfTours(supabase, pageTours.map((t) => t.id));
  const byTour = new Map<string, TourScanRaw[]>();
  for (const s of tourScans) byTour.set(s.tour_id, [...(byTour.get(s.tour_id) ?? []), s]);
  const tours = pageTours.map((t) => assembleTour(t, byTour.get(t.id) ?? [], activeByProject.get(t.project_id) ?? [], tourPointIds));

  /* ---------- aralık özeti ---------- */
  const summary = summaryRows.map((r) => {
    const missed = Array.isArray(r.missed) ? (r.missed as string[]) : [];
    return { id: r.id, project_id: r.project_id, missed, status: tourStatus({ end_kind: r.end_kind, missed }) };
  });
  const tally = (rows: typeof summary) => {
    const n = (s: TourStatus) => rows.filter((r) => r.status === s).length;
    return {
      tours: rows.length, done: n("tamam"), partial: n("eksik"), late: n("zaman_asimi"), open: n("devam"),
      missed: rows.reduce((a, r) => a + (r.status === "devam" ? 0 : r.missed.length), 0),
    };
  };
  const all = tally(summary);

  // nokta durumu: her aktif nokta kaç turda okutuldu / atlandı (en çok atlanan üstte)
  const scannedBy = new Map<string, Set<string>>();
  const inSummary = new Set(summary.map((t) => t.id));
  for (const p of pairs) if (inSummary.has(p.tour_id)) scannedBy.set(p.tour_id, (scannedBy.get(p.tour_id) ?? new Set()).add(p.point_id));
  const pointStats = hasProject
    ? checkpointStats(activeByProject.get(projectId) ?? [], summary.map((t) => ({ closed: t.status !== "devam", missed: t.missed, scanned: scannedBy.get(t.id) ?? new Set<string>() })))
        .map((p, i) => ({ ...p, i }))
        .sort((a, b) => b.missed - a.missed || a.i - b.i)
    : [];
  const skippedPoints = pointStats.filter((p) => p.missed > 0).length;
  const closedTours = summary.filter((t) => t.status !== "devam").length;

  /* ---------- eski sistem okutmaları ---------- */
  const legacy = (legacyRes.data ?? []) as Scan[];
  const legacyTotal = legacyRes.count ?? legacy.length;
  const nameOf = legacy.length ? await scannerNames(legacy) : () => "—";

  /* ---------- bağlantılar ve filtreler ---------- */
  const pdfHref = (pid: string, inline = false) =>
    `/api/patrol/report?${new URLSearchParams({
      proje: pid,
      ...(oneDay ? { tarih: start } : { bas: start, bit: end }),
      ...(status ? { durum: status } : {}),
      ...(person ? { personel: person } : {}),
      ...(inline ? { goster: "1" } : {}),
    }).toString()}`;

  const fields: FilterField[] = [
    ...(single ? [] : [{ name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: patrolProjects.map((p) => ({ value: p.id, label: p.name })) }]),
    { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange", value: start, valueTo: end, min: oldest, max: today },
    { name: "durum", label: "Durum", value: status ?? "", all: "Tümü", options: STATUS_ORDER.map((s) => ({ value: s, label: TOUR_STATUS[s].label })) },
    { name: "personel", label: "Personel", kind: "text", value: person ?? "", placeholder: "Ad ile ara" },
  ];

  const rangeLabel = oneDay ? (start === today ? `Bugün · ${fmtDayLong(start)}` : fmtDayLong(start)) : `${fmtDay(start)} – ${fmtDay(end)}`;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  if (shownProjects.length === 0) {
    return (
      <>
        <FilterBar action={PATH} fields={fields} />
        <Card><EmptyState title="Devriye noktası tanımlı proje yok" description="Noktalar ve PIN sekmesinden projeye nokta ekleyin." /></Card>
      </>
    );
  }

  return (
    <>
      <FilterBar action={PATH} fields={fields} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tur sayısı" value={all.tours} hint={all.open ? `${rangeLabel} · ${all.open} tur devam ediyor` : rangeLabel} icon={Route} tone="blue" />
        <Stat label="Tamamlanan" value={all.done} hint={all.tours ? `Turların %${pct(all.done, all.tours)}'i eksiksiz bitirildi` : undefined} icon={CircleCheck} tone="emerald" />
        <Stat label="Eksik + zaman aşımı" value={all.partial + all.late} hint={`${all.partial} eksik · ${all.late} zaman aşımı`} icon={TriangleAlert} tone="amber" />
        <Stat label="Toplam atlanan nokta" value={all.missed} hint="Kapanan turlarda okutulmayan noktalar" icon={MapPinOff} tone="rose" />
      </div>

      {hasProject && pointStats.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title="Nokta durumu"
            description={
              closedTours === 0
                ? "Bu aralıkta kapanmış tur yok; noktaların atlanıp atlanmadığı tur bitince görünür."
                : skippedPoints
                  ? `${pointStats.length} noktadan ${skippedPoints} tanesi en az bir turda atlandı · en çok atlanan üstte.`
                  : `${pointStats.length} noktanın hiçbiri atlanmadı.`
            }
          />
          <Table numeric={[1, 2]} head={["Nokta", "Okutulan tur", "Atlanan tur", "Atlanma oranı"]}>
            {pointStats.map((p) => {
              const rate = pct(p.missed, p.scanned + p.missed);
              return (
                <tr key={p.id} className={cn(p.missed > 0 && rate >= 50 && "bg-danger-soft/40")}>
                  <td className={cn(td, "font-medium")}>{p.name}</td>
                  <td className={tdNum}>{p.scanned}</td>
                  <td className={cn(tdNum, p.missed > 0 && "font-semibold text-danger")}>{p.missed}</td>
                  <td className={td}>
                    {p.scanned + p.missed === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name}: turların %${rate}'inde atlandı`}>
                          <span className={cn("block h-full rounded-full", rate === 0 ? "bg-success" : rate < 50 ? "bg-warning" : "bg-danger")} style={{ width: `${Math.max(rate, rate ? 4 : 0)}%` }} />
                        </span>
                        <span className={cn("text-xs tabular-nums", rate ? "text-danger" : "text-muted")}>%{rate}</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {!hasProject && (
        <Card className="mb-6">
          <CardHeader title="Proje bazında" description="Seçili aralıkta her projenin turları; PDF raporu projeye göre alınır." />
          <Table numeric={[1, 2, 3, 4, 5]} head={["Proje", "Tur", "Tamamlanan", "Eksik", "Zaman aşımı", "Atlanan nokta", ""]}>
            {shownProjects.map((p) => {
              const r = tally(summary.filter((t) => t.project_id === p.id));
              return (
                <tr key={p.id}>
                  <td className={cn(td, "font-medium")}>
                    {p.name}
                    {r.tours === 0 && <span className="ml-2"><Badge tone="danger">Devriye yok</Badge></span>}
                  </td>
                  <td className={tdNum}>{r.tours}{r.open > 0 && <span className="ml-1 text-xs text-brand">({r.open} açık)</span>}</td>
                  <td className={cn(tdNum, r.done > 0 && "text-success")}>{r.done}</td>
                  <td className={cn(tdNum, r.partial > 0 && "font-medium text-warning")}>{r.partial}</td>
                  <td className={cn(tdNum, r.late > 0 && "font-medium text-danger")}>{r.late}</td>
                  <td className={cn(tdNum, r.missed > 0 && "font-medium text-danger")}>{r.missed}</td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    {r.tours > 0 && (
                      <>
                        <a href={pdfHref(p.id, true)} target="_blank" rel="noopener noreferrer" className="mr-2 text-sm font-medium text-brand hover:underline">Görüntüle</a>
                        <a href={pdfHref(p.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">
                          <FileDown className="size-4" aria-hidden /> PDF
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`Turlar · ${rangeLabel}`}
          description={`${total} tur${status ? ` (${TOUR_STATUS[status].label})` : ""} · en yeni üstte · ayrıntı için tura tıklayın · kayıtlar ${PATROL_KEEP_DAYS} gün saklanır`}
          action={hasProject ? (
            <span className="inline-flex items-center gap-2">
              <a href={pdfHref(projectId, true)} target="_blank" rel="noopener noreferrer" className={btn("secondary", "sm")}>Görüntüle</a>
              <a href={pdfHref(projectId)} className={btn("primary", "sm")}><FileDown className="size-4" aria-hidden /> {oneDay ? "Gün raporu PDF" : "Aralık raporu PDF"}</a>
            </span>
          ) : (
            <span className="text-sm text-muted">PDF için bir proje seçin.</span>
          )}
        />
        {tours.length === 0 ? (
          <EmptyState title={status || person ? "Filtreye uyan tur yok" : "Bu aralıkta devriye turu yok"} description={EMPTY_HELP} />
        ) : (
          <>
            <div className={cn("hidden gap-x-4 border-b border-border bg-surface-2/60 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted md:grid", GRID)}>
              <span className="pl-6">Personel</span>
              <span>Başlangıç</span>
              <span>Bitiş</span>
              <span>Süre</span>
              <span>Nokta</span>
              <span>Nokta adı</span>
              <span>Durum</span>
            </div>
            <ul className="divide-y divide-border">
              {tours.map((t) => (
                <TourItem key={t.id} t={t} projectLabel={hasProject ? undefined : projectName.get(t.project_id)} pointName={pointName} />
              ))}
            </ul>
          </>
        )}
        <Pagination path={PATH} searchParams={sp} total={total} size={PAGE} />
      </Card>

      {legacyTotal > 0 && (
        <Card className="mt-6">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="text-base font-semibold">Tur dışı okutmalar (eski sistem)</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {legacyTotal} okutma · tur sistemi öncesinde tek tek yapılan okutmalar · durum ve personel filtresi uygulanmaz
                  {legacyTotal > legacy.length && ` · en yeni ${legacy.length} tanesi gösteriliyor`}
                </p>
              </div>
              <ChevronDown className="mt-1 size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-border">
              <ScanTable scans={legacy} oneDay={oneDay} showProject={!hasProject} pointName={pointName} projectName={projectName} nameOf={nameOf} />
            </div>
          </details>
        </Card>
      )}
    </>
  );
}
