import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Table, btn, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions, type FilterField } from "@/components/filter-bar";
import { canAnywhere, requireUser } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getAccessibleProjects, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { REPORT_DEFS, buildReport, type Cell, type ColType, type ReportType } from "@/lib/reports";
import { MONTHS, formatDate, formatMoney, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Raporlar" };

const fmt = (v: Cell, t: ColType) => {
  if (v === null || v === "") return "—";
  if (t === "money") return formatMoney(Number(v));
  if (t === "number") return formatNumber(Number(v));
  if (t === "date") return formatDate(String(v));
  return String(v);
};

export default async function ReportsPage({ searchParams }: PageProps<"/raporlar">) {
  const user = await requireUser();
  await requireModule("raporlar");
  if (!canAnywhere(user, "reports.read")) notFound();
  const sp = await searchParams;

  const available = (Object.keys(REPORT_DEFS) as ReportType[]).filter((t) => canAnywhere(user, REPORT_DEFS[t].permission));
  const requested = str1(sp.tur) as ReportType | undefined;
  const type = requested && available.includes(requested) ? requested : available[0];
  if (!type) notFound();

  const now = new Date();
  const year = Number(str1(sp.yil) ?? now.getFullYear());
  const month = Number(str1(sp.ay) ?? now.getMonth() + 1);
  const days = Number(str1(sp.gun) ?? 60);
  const projectId = str1(sp.proje);
  const projects = await getAccessibleProjects();

  const report = await buildReport(type, { projectId, year, month, days }, await createClient());

  const projectField: FilterField = { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) };
  const fields: FilterField[] = [
    ...(type === "contracts" ? [] : [projectField]),
    ...(type === "timesheet" ? [{ name: "ay", label: "Ay", value: String(month), options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) }] : []),
    ...(type === "timesheet" || type === "finance" || type === "leave" ? [{ name: "yil", label: "Yıl", value: String(year), options: yearOptions() }] : []),
    ...(type === "contracts" ? [{ name: "gun", label: "Süre", value: String(days), options: [30, 60, 90, 180, 365].map((d) => ({ value: String(d), label: `${d} gün içinde` })) }] : []),
  ];
  const qs = new URLSearchParams({ type, yil: String(year), ay: String(month), gun: String(days), ...(projectId ? { proje: projectId } : {}) });

  return (
    <>
      <PageHeader title="Raporlar" description="Hazır raporları görüntüleyin, Excel olarak indirin." />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Rapor türü">
        {available.map((t) => (
          <Link
            key={t}
            href={`/raporlar?tur=${t}`}
            role="tab"
            aria-selected={t === type}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", t === type ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-muted hover:text-fg")}
          >
            {REPORT_DEFS[t].title}
          </Link>
        ))}
      </div>

      <FilterBar action="/raporlar" fields={fields}>
        <input type="hidden" name="tur" value={type} />
      </FilterBar>

      <Card>
        <CardHeader
          title={report.title}
          description={`${report.subtitle} · ${report.rows.length} satır — ${REPORT_DEFS[type].description}`}
          action={<a href={`/api/reports?${qs.toString()}`} className={btn("primary", "sm")}><Download className="size-4" aria-hidden /> Excel indir</a>}
        />
        {report.rows.length === 0 ? (
          <EmptyState title="Bu filtrelerle sonuç yok" />
        ) : (
          <Table numeric={report.columns.flatMap((c, i) => (c.type === "number" || c.type === "money" ? [i] : []))} head={report.columns.map((c) => c.label)}>
            {report.rows.slice(0, 300).map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => {
                  const t = report.columns[j].type;
                  return <td key={j} className={t === "text" || t === "date" ? td : tdNum}>{fmt(v, t)}</td>;
                })}
              </tr>
            ))}
          </Table>
        )}
        {report.rows.length > 300 && <p className="border-t border-border px-5 py-3 text-xs text-muted">İlk 300 satır gösteriliyor; tamamı için Excel indirin.</p>}
      </Card>
    </>
  );
}
