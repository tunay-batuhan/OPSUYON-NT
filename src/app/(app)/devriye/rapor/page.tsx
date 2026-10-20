import type { Metadata } from "next";
import { Card, CardHeader, EmptyState, PageHeader, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions, type FilterField } from "@/components/filter-bar";
import { DemoNotice } from "@/components/demo-notice";
import { requireAccess } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { MONTHS } from "@/lib/format";
import { dayRange, fmtClock, fmtDay, istanbulDay, monthRange } from "@/lib/patrol";

export const metadata: Metadata = { title: "Devriye Rapor" };

type Scan = { project_id: string; point_id: string; scanned_at: string };

/**
 * Günlük devriye raporları: Gün · Ay · Yıl filtresi. Her gün ve proje için okutma kayıtlarından otomatik
 * oluşan rapor altta görüntülenir ve PDF olarak indirilir.
 */
export default async function PatrolReportsPage({ searchParams }: PageProps<"/devriye/rapor">) {
  await requireAccess("devriye", "patrol.read");
  const sp = await searchParams;

  const today = istanbulDay(new Date());
  const [ty, tm, td_] = today.split("-").map(Number);
  const year = Number(str1(sp.yil) ?? ty);
  const month = Number(str1(sp.ay) ?? tm);
  // Gün: varsayılan bugün (yalnızca bu ay/yıl seçiliyken); "Tümü" seçilirse ayın tüm günleri
  const dayParam = str1(sp.gun);
  const dayDefault = year === ty && month === tm && sp.gun === undefined ? String(td_) : "";
  const day = dayParam ?? dayDefault;
  const projectId = str1(sp.proje);
  const selected = str1(sp.sec);

  const supabase = await createClient();
  const range = day ? dayRange(`${year}-${String(month).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`) : monthRange(year, month);

  let q = supabase.from("patrol_scans").select("project_id, point_id, scanned_at").gte("scanned_at", range.from).lt("scanned_at", range.to).order("scanned_at").limit(5000);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  const [{ data: scans }, { data: points }, projects] = await Promise.all([
    q,
    supabase.from("patrol_points").select("id, project_id, is_active"),
    getAccessibleProjects(),
  ]);

  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  const activePoints = new Map<string, number>();
  const withPoints = new Set<string>();
  for (const p of points ?? []) {
    withPoints.add(p.project_id as string);
    if (p.is_active) activePoints.set(p.project_id as string, (activePoints.get(p.project_id as string) ?? 0) + 1);
  }

  type Row = { key: string; project: string; date: string; scans: Scan[] };
  const groups = new Map<string, Row>();
  for (const s of (scans ?? []) as Scan[]) {
    const date = istanbulDay(s.scanned_at);
    const key = `${s.project_id}|${date}`;
    const g = groups.get(key) ?? { key, project: s.project_id, date, scans: [] };
    g.scans.push(s);
    groups.set(key, g);
  }
  const rows = [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || (nameOf.get(a.project) ?? "").localeCompare(nameOf.get(b.project) ?? "", "tr"));
  const shown = rows.find((r) => r.key === selected) ?? rows[0];

  const dayOptions = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  const fields: FilterField[] = [
    { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.filter((p) => withPoints.has(p.id)).map((p) => ({ value: p.id, label: p.name })) },
    { name: "gun", label: "Gün", value: day, all: "Tümü", options: dayOptions },
    { name: "ay", label: "Ay", value: String(month), options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
    { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
  ];
  const link = (r: Row) => `/devriye/rapor?${new URLSearchParams({ ...(projectId ? { proje: projectId } : {}), gun: day, ay: String(month), yil: String(year), sec: r.key }).toString()}`;
  const pdfHref = (r: Row) => `/api/patrol/report?proje=${r.project}&tarih=${r.date}`;

  return (
    <>
      <PageHeader title="Devriye Rapor" description="Gün, ay ve yıl seçin; o günün devriye raporu okutma kayıtlarından otomatik oluşur. PDF olarak indirebilirsiniz." />
      <DemoNotice />
      <FilterBar action="/devriye/rapor" fields={fields} />

      <Card>
        <CardHeader title={day ? `${fmtDay(`${year}-${String(month).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`)}` : `${MONTHS[month - 1]} ${year}`} description={`${rows.length} rapor`} />
        {rows.length === 0 ? (
          <EmptyState title="Bu tarih için devriye kaydı yok" description="Devriye görevlisi o gün barkod okutmadıysa rapor oluşmaz." />
        ) : (
          <Table numeric={[3, 4]} head={["Tarih", "Proje", "Okutulan nokta", "Okutma", "Saat aralığı", ""]}>
            {rows.map((r) => {
              const distinct = new Set(r.scans.map((s) => s.point_id)).size;
              const total = activePoints.get(r.project) ?? distinct;
              return (
                <tr key={r.key} className={cn(shown?.key === r.key && "bg-brand-soft/40")}>
                  <td className={cn(td, "font-medium")}>{fmtDay(r.date)}</td>
                  <td className={td}>{nameOf.get(r.project) ?? "—"}</td>
                  <td className={tdNum}>{distinct} / {Math.max(total, distinct)}</td>
                  <td className={tdNum}>{r.scans.length}</td>
                  <td className={cn(td, "whitespace-nowrap text-muted")}>{fmtClock(r.scans[0].scanned_at, false)} – {fmtClock(r.scans[r.scans.length - 1].scanned_at, false)}</td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    {shown?.key !== r.key && <a href={link(r)} className="mr-2 text-sm font-medium text-brand hover:underline">Görüntüle</a>}
                    <a href={pdfHref(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">PDF indir</a>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {shown && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-5 py-3">
            <p className="font-semibold">Devriye Raporu · {nameOf.get(shown.project)} · {fmtDay(shown.date)}</p>
            <a href={pdfHref(shown)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">PDF indir</a>
          </div>
          <iframe src={`${pdfHref(shown)}&goster=1`} title="Devriye raporu" className="h-[75vh] min-h-96 w-full bg-white" />
        </div>
      )}
    </>
  );
}
