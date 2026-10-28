import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, EyeOff, Trash2 } from "lucide-react";
import { Card, CardHeader, EmptyState, Table, cn, td } from "@/components/ui";
import { ViewButton } from "@/components/doc-viewer";
import { formatBytes, formatDate, formatPeriod } from "@/lib/format";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { DocumentCategory, DocumentRow } from "@/lib/types";
import { deleteDocument, setDocumentVisibility } from "@/app/actions/documents";
import { UploadForm } from "./upload-form";

type Row = DocumentRow & { personnel: { full_name: string } | null };

/** Belgeler, ait oldukları belge türünün altında gruplanarak listelenir. */
export default async function DocumentsPage({ params, searchParams }: PageProps<"/projeler/[id]/belgeler">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(id);
  const manage = can(ctx, "documents.manage");

  const supabase = await createClient();
  const { data: cats } = await supabase.from("document_categories").select("*").eq("is_active", true).order("sort_order");
  const categories = ((cats ?? []) as DocumentCategory[]).filter((c) => manage || can(ctx, c.permission_code));
  if (categories.length === 0) notFound();

  const active = typeof sp.kategori === "string" && categories.some((c) => c.code === sp.kategori) ? sp.kategori : undefined;
  const shown = active ? categories.filter((c) => c.code === active) : categories;

  const { data } = await supabase
    .from("documents")
    .select("*, personnel(full_name)")
    .eq("project_id", id)
    .in("category_code", categories.map((c) => c.code))
    .order("period_year", { ascending: false, nullsFirst: false })
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const byCategory = new Map<string, Row[]>();
  rows.forEach((r) => byCategory.set(r.category_code, [...(byCategory.get(r.category_code) ?? []), r]));

  const people = manage
    ? (((await supabase.from("personnel_assignments").select("personnel(id, full_name)").eq("project_id", id)).data ?? []) as unknown as {
        personnel: { id: string; full_name: string } | null;
      }[])
        .map((a) => a.personnel)
        .filter((p): p is { id: string; full_name: string } => Boolean(p))
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Belge türü">
        <Link href={`/projeler/${id}/belgeler`} className={chip(!active)}>Tümü ({rows.length})</Link>
        {categories.filter((c) => manage || (byCategory.get(c.code)?.length ?? 0) > 0).map((c) => (
          <Link key={c.code} href={`/projeler/${id}/belgeler?kategori=${c.code}`} className={chip(active === c.code)}>
            {c.name} ({byCategory.get(c.code)?.length ?? 0})
          </Link>
        ))}
      </div>

      {shown.map((c) => {
        const list = byCategory.get(c.code) ?? [];
        // Boş bölümler yalnızca belirli bir tür seçiliyse veya yönetici için gösterilir
        if (!list.length && !active && !manage) return null;
        return (
          <Card key={c.code} id={c.code}>
            <CardHeader title={c.name} description={`${list.length} belge`} />
            {list.length === 0 ? (
              <EmptyState title="Bu belge türünde belge yok" description={manage ? "Aşağıdaki formdan yükleyebilirsiniz." : undefined} />
            ) : (
              <Table head={["Belge", "Personel", "Dönem", "Boyut", "Tarih", manage ? "Görünürlük" : null, ""].filter((h) => h !== null)}>
                {list.map((d) => (
                  <tr key={d.id}>
                    <td className={td}>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted">{d.file_name}</p>
                    </td>
                    <td className={td}>{d.personnel?.full_name ?? "—"}</td>
                    <td className={td}>{formatPeriod(d.period_year, d.period_month)}</td>
                    <td className={td}>{formatBytes(d.size_bytes)}</td>
                    <td className={td}>{formatDate(d.created_at)}</td>
                    {manage && (
                      <td className={td}>
                        <form action={setDocumentVisibility} className="inline">
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="visible" value={d.customer_visible ? "0" : "1"} />
                          <button className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg" title="Müşteri görünürlüğünü değiştir">
                            {d.customer_visible ? <Eye className="size-4 text-success" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                            {d.customer_visible ? "Yayında" : "Gizli"}
                          </button>
                        </form>
                      </td>
                    )}
                    <td className={cn(td, "whitespace-nowrap text-right")}>
                      <a href={`/api/documents/${d.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-surface-2">
                        <Download className="size-4" aria-hidden /> İndir
                      </a>
                      <ViewButton src={`/api/documents/${d.id}/view`} title={d.title} downloadHref={`/api/documents/${d.id}`} className="ml-2" />
                      {manage && (
                        <form action={deleteDocument} className="ml-2 inline">
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="project_id" value={id} />
                          <button className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`${d.title} belgesini sil`}>
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        );
      })}

      {manage && (
        <Card>
          <CardHeader title="Belge yükle" description="Yüklenen belge, 'Müşteri görebilsin' işaretlenmedikçe yalnızca merkezde görünür." />
          <UploadForm projectId={id} categories={categories} people={people} defaultCategory={active} />
        </Card>
      )}
    </div>
  );
}

const chip = (on: boolean) =>
  cn("rounded-full border px-3 py-1 text-sm", on ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-fg");
