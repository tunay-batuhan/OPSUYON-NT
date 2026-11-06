import type { Metadata } from "next";
import { Card, CardHeader, EmptyState, Table, cn, td } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { PdfIcon } from "@/components/doc-ui";
import { Pagination } from "@/components/pagination";
import { hasPermission } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { requireAccess } from "@/lib/modules";
import { pagingFrom } from "@/lib/paging";
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
  const user = await requireAccess("denetimler", "inspections.read");
  const sp = await searchParams;
  const now = new Date();
  const projectId = str1(sp.proje);
  const month = str1(sp.ay) ?? String(now.getMonth() + 1);
  const year = str1(sp.yil) ?? String(now.getFullYear());
  const shift = str1(sp.vardiya);
  const projects = await getAccessibleProjects();
  const manage = user.kind === "staff" && hasPermission(user, "documents.manage");
  const { from, to } = pagingFrom(sp);

  const supabase = await createClient();
  const query = (byInspectionDate: boolean) => {
    let q = supabase
      .from("documents")
      .select("id, title, created_at, period_year, period_month, metadata, projects(name)", { count: "exact" })
      .eq("category_code", "denetim")
      .eq("period_year", Number(year))
      .eq("period_month", Number(month));
    if (byInspectionDate) q = q.order("metadata->>inspection_date", { ascending: false, nullsFirst: false });
    q = q.order("created_at", { ascending: false }).range(from, to);
    if (isUuid(projectId)) q = q.eq("project_id", projectId);
    if (shift && SHIFT[shift]) q = q.eq("metadata->>inspection_shift", shift);
    return q;
  };
  // Denetim gününe göre sıralama (JSON alanı); desteklenmezse yükleme tarihine düşer
  let res = await query(true);
  if (res.error) res = await query(false);
  const rows = (res.data ?? []) as unknown as Row[];
  const total = res.count ?? 0;

  return (
    <>
      <FilterBar
        action="/denetimler"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "vardiya", label: "Gece / Gündüz", value: shift, all: "Tümü", options: [{ value: "gece", label: "Gece" }, { value: "gunduz", label: "Gündüz" }] },
          { name: "ay", label: "Ay", value: month, options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
          { name: "yil", label: "Yıl", value: year, options: yearOptions() },
        ]}
      />
      <Card>
        <CardHeader title={`${MONTHS[Number(month) - 1] ?? ""} ${year}`} description={`${total} kayıt`} />
        {rows.length === 0 ? (
          <EmptyState
            title="Bu dönemde denetim kaydı yok"
            description={manage ? "“Yeni denetim ekle” sekmesinden denetim raporu yükleyebilirsiniz." : undefined}
          />
        ) : (
          <>
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
            <Pagination path="/denetimler" searchParams={sp} total={total} />
          </>
        )}
      </Card>
    </>
  );
}
