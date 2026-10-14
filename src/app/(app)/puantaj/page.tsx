import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Table, btn, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Puantaj" };

type Row = {
  id: string; project_id: string; worked_days: number; leave_days: number; absence_days: number; overtime_hours: number;
  projects: { name: string } | null; personnel: { full_name: string } | null;
};

export default async function TimesheetsAllPage({ searchParams }: PageProps<"/puantaj">) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(str1(sp.yil) ?? now.getFullYear());
  const month = Number(str1(sp.ay) ?? now.getMonth() + 1);
  const projectId = str1(sp.proje);
  const projects = await getAccessibleProjects();

  const supabase = await createClient();
  let q = supabase
    .from("timesheets")
    .select("id, project_id, worked_days, leave_days, absence_days, overtime_hours, projects(name), personnel(full_name)")
    .eq("period_year", year).eq("period_month", month).limit(2000);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  const { data } = await q;
  const rows = ((data ?? []) as unknown as Row[]).sort(
    (a, b) => (a.projects?.name ?? "").localeCompare(b.projects?.name ?? "", "tr") || (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"),
  );
  const sum = (k: "worked_days" | "leave_days" | "absence_days" | "overtime_hours") => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const manage = canAnywhere(user, "timesheets.manage");
  const exportHref = `/api/reports?type=timesheet&yil=${year}&ay=${month}${isUuid(projectId) ? `&proje=${projectId}` : ""}`;

  return (
    <>
      <PageHeader
        title="Puantaj"
        description="Tüm projelerin aylık puantajı."
        actions={canAnywhere(user, "reports.read") && <a href={exportHref} className={btn("secondary", "md")}><Download className="size-4" aria-hidden /> Excel indir</a>}
      />
      <FilterBar
        action="/puantaj"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "ay", label: "Ay", value: String(month), options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
          { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
        ]}
      />
      <Card>
        <CardHeader title={`${MONTHS[month - 1]} ${year}`} description={`${rows.length} kayıt`} />
        {rows.length === 0 ? (
          <EmptyState title="Bu dönem için puantaj yok" description={manage ? "Proje sayfasından girebilir veya Excel ile toplu aktarabilirsiniz." : undefined} />
        ) : (
          <Table head={["Proje", "Personel", "Çalışılan gün", "İzin", "Devamsızlık", "Fazla mesai (sa)", manage ? "" : null].filter((h) => h !== null)}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.projects?.name}</td>
                <td className={cn(td, "font-medium")}>{r.personnel?.full_name}</td>
                <td className={tdNum}>{formatNumber(r.worked_days)}</td>
                <td className={tdNum}>{formatNumber(r.leave_days)}</td>
                <td className={tdNum}>{formatNumber(r.absence_days)}</td>
                <td className={tdNum}>{formatNumber(r.overtime_hours)}</td>
                {manage && <td className={td}><Link href={`/projeler/${r.project_id}/puantaj?ay=${month}&yil=${year}`} className="text-sm text-brand">Düzenle</Link></td>}
              </tr>
            ))}
            <tr className="bg-surface-2 font-medium">
              <td className={td} colSpan={2}>Toplam</td>
              <td className={tdNum}>{formatNumber(sum("worked_days"))}</td>
              <td className={tdNum}>{formatNumber(sum("leave_days"))}</td>
              <td className={tdNum}>{formatNumber(sum("absence_days"))}</td>
              <td className={tdNum}>{formatNumber(sum("overtime_hours"))}</td>
              {manage && <td className={td} />}
            </tr>
          </Table>
        )}
      </Card>
    </>
  );
}
