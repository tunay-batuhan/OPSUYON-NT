import type { Metadata } from "next";
import { Card, CardHeader, EmptyState, PageHeader, Table, cn, td } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { PdfIcon } from "@/components/doc-ui";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { requireAccess } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Denetimler" };

type Row = {
  id: string; title: string; created_at: string; period_year: number | null; period_month: number | null;
  metadata: { inspection_date?: string; inspection_shift?: string } | null;
  projects: { name: string } | null;
};

const SHIFT: Record<string, string> = { gece: "Gece", gunduz: "Gündüz" };

/** Yapılan denetimler: tarih, gece/gündüz, denetim raporu (PDF). */
export default async function InspectionsPage({ searchParams }: PageProps<"/denetimler">) {
  await requireAccess("denetimler", "inspections.read");
  const sp = await searchParams;
  const now = new Date();
  const projectId = str1(sp.proje);
  const month = str1(sp.ay) ?? String(now.getMonth() + 1);
  const year = str1(sp.yil) ?? String(now.getFullYear());
  const projects = await getAccessibleProjects();

  const supabase = await createClient();
  let q = supabase
    .from("documents")
    .select("id, title, created_at, period_year, period_month, metadata, projects(name)")
    .eq("category_code", "denetim")
    .eq("period_year", Number(year))
    .eq("period_month", Number(month))
    .limit(500);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  const { data } = await q;
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => (b.metadata?.inspection_date ?? b.created_at).localeCompare(a.metadata?.inspection_date ?? a.created_at));

  return (
    <>
      <PageHeader title="Denetimler" description="Yapılan denetimlerin raporları." />
      <FilterBar
        action="/denetimler"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "ay", label: "Ay", value: month, options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
          { name: "yil", label: "Yıl", value: year, options: yearOptions() },
        ]}
      />
      <Card>
        <CardHeader title={`${MONTHS[Number(month) - 1]} ${year}`} description={`${rows.length} kayıt`} />
        {rows.length === 0 ? (
          <EmptyState title="Bu dönemde denetim kaydı yok" />
        ) : (
          <Table head={["Tarih", "Gece / Gündüz", "Proje", "Denetim raporu"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, "font-medium")}>{formatDate(r.metadata?.inspection_date ?? r.created_at)}</td>
                <td className={td}>{SHIFT[r.metadata?.inspection_shift ?? ""] ?? "—"}</td>
                <td className={cn(td, "text-muted")}>{r.projects?.name}</td>
                <td className={td}><PdfIcon id={r.id} title={r.title} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
