import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, btn, td } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { ViewButton } from "@/components/doc-viewer";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatBytes, formatDate, formatPeriod } from "@/lib/format";

type Row = {
  id: string; project_id: string; title: string; file_name: string; size_bytes: number | null; period_year: number | null;
  period_month: number | null; created_at: string; customer_visible: boolean;
  projects: { name: string } | null; personnel: { full_name: string } | null;
};

/** Top-level list of one document category (Sözleşmeler, Bordrolar…) across every project the caller can see. */
export async function CategoryDocuments({
  category, title, description, path, searchParams, periodic = false,
}: {
  category: string; title: string; description: string; path: string; periodic?: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const projectId = str1(searchParams.proje);
  const year = str1(searchParams.yil);
  const month = str1(searchParams.ay);
  const projects = await getAccessibleProjects();

  const supabase = await createClient();
  let q = supabase
    .from("documents")
    .select("id, project_id, title, file_name, size_bytes, period_year, period_month, created_at, customer_visible, projects(name), personnel(full_name)")
    .eq("category_code", category)
    .order("period_year", { ascending: false, nullsFirst: false })
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  if (year) q = q.eq("period_year", Number(year));
  if (month) q = q.eq("period_month", Number(month));
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const manage = canAnywhere(user, "documents.manage");

  const fields = [{ name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) }];
  if (periodic) {
    fields.push(
      { name: "ay", label: "Ay", value: month, all: "Tümü", options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
      { name: "yil", label: "Yıl", value: year, all: "Tümü", options: yearOptions() },
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          manage &&
          (isUuid(projectId) ? (
            <Link href={`/projeler/${projectId}/belgeler?kategori=${category}`} className={btn("primary", "md")}>
              <Upload className="size-4" aria-hidden /> Belge yükle
            </Link>
          ) : (
            <span className="text-sm text-muted">Belge yüklemek için bir proje seçin</span>
          ))
        }
      />
      <FilterBar action={path} fields={fields} />
      <Card>
        <CardHeader title={`${rows.length} belge`} />
        {rows.length === 0 ? (
          <EmptyState title="Belge bulunamadı" description={manage ? "Proje seçip belge yükleyebilirsiniz." : "Merkez belge paylaştığında burada görünür."} />
        ) : (
          <Table head={["Belge", "Proje", "Personel", periodic ? "Dönem" : "Tarih", "Boyut", manage ? "Görünürlük" : null, ""].filter((h) => h !== null)}>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className={td}>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted">{d.file_name}</p>
                </td>
                <td className={td}>{d.projects?.name}</td>
                <td className={td}>{d.personnel?.full_name ?? "—"}</td>
                <td className={td}>{periodic ? formatPeriod(d.period_year, d.period_month) : formatDate(d.created_at)}</td>
                <td className={td}>{formatBytes(d.size_bytes)}</td>
                {manage && <td className={td}><Badge tone={d.customer_visible ? "success" : "neutral"}>{d.customer_visible ? "Yayında" : "Gizli"}</Badge></td>}
                <td className={`${td} whitespace-nowrap text-right`}>
                  <a href={`/api/documents/${d.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-surface-2">
                    <Download className="size-4" aria-hidden /> İndir
                  </a>
                  <ViewButton src={`/api/documents/${d.id}/view`} title={d.title} downloadHref={`/api/documents/${d.id}`} className="ml-2" />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
