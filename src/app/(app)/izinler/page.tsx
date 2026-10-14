import type { Metadata } from "next";
import { Card, CardHeader, EmptyState, PageHeader, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { requireUser } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "İzin Yönetimi" };

type Row = {
  id: string; entitled_days: number; carried_days: number; used_days: number; remaining_days: number;
  personnel: { id: string; full_name: string; personnel_assignments: { project_id: string; end_date: string | null; projects: { name: string } | null }[] } | null;
};

export default async function LeavesAllPage({ searchParams }: PageProps<"/izinler">) {
  await requireUser();
  const sp = await searchParams;
  const year = Number(str1(sp.yil) ?? new Date().getFullYear());
  const projectId = str1(sp.proje);
  const projects = await getAccessibleProjects();

  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_balances")
    .select("id, entitled_days, carried_days, used_days, remaining_days, personnel(id, full_name, personnel_assignments(project_id, end_date, projects(name)))")
    .eq("year", year)
    .limit(2000);
  let rows = (data ?? []) as unknown as Row[];
  if (isUuid(projectId)) rows = rows.filter((r) => r.personnel?.personnel_assignments.some((a) => a.project_id === projectId));
  rows.sort((a, b) => (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"));

  return (
    <>
      <PageHeader title="İzin Yönetimi" description="Personelin yıllık izin hak ve kullanım durumu." />
      <FilterBar
        action="/izinler"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
        ]}
      />
      <Card>
        <CardHeader title={`${year} yıllık izin durumu`} description={`${rows.length} personel`} />
        {rows.length === 0 ? (
          <EmptyState title="Bu yıl için izin bilgisi yok" />
        ) : (
          <Table head={["Personel", "Proje", "Hak edilen", "Devreden", "Kullanılan", "Kalan"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, "font-medium")}>{r.personnel?.full_name}</td>
                <td className={cn(td, "text-muted")}>{[...new Set((r.personnel?.personnel_assignments ?? []).filter((a) => !a.end_date).map((a) => a.projects?.name).filter(Boolean))].join(", ") || "—"}</td>
                <td className={tdNum}>{formatNumber(r.entitled_days)}</td>
                <td className={tdNum}>{formatNumber(r.carried_days)}</td>
                <td className={tdNum}>{formatNumber(r.used_days)}</td>
                <td className={cn(tdNum, "font-semibold", Number(r.remaining_days) < 0 && "text-danger")}>{formatNumber(r.remaining_days)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
