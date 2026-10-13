import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, Table, td, tdNum } from "@/components/ui";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { IMPORT_DEFS } from "@/lib/import/defs";
import { ImportWizard } from "./import-wizard";

type Rec = { id: string; kind: string; file_name: string; status: string; total_rows: number | null; success_rows: number | null; error_rows: number | null; created_at: string };

export default async function ImportPage({ params }: PageProps<"/projeler/[id]/aktar">) {
  const { id } = await params;
  const ctx = await getProjectContext(id);
  if (!can(ctx, "imports.manage")) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("imports")
    .select("id, kind, file_name, status, total_rows, success_rows, error_rows, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(15);
  const history = (data ?? []) as Rec[];

  // Only offer the import types the caller may actually write.
  const defs = Object.values(IMPORT_DEFS)
    .filter((d) => can(ctx, d.permission))
    .map((d) => ({
      type: d.type, title: d.title, description: d.description, usesPeriod: d.usesPeriod,
      columns: d.columns.map((c) => ({ label: c.label, required: c.required, note: c.note })),
    }));
  if (defs.length === 0) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Excel ile toplu aktarım"
          description="Dosyayı yükleyin, önizlemede hataları görün, onaylayınca projeye işlensin. Hatalı satırlar atlanır; diğerleri aktarılır."
        />
        <ImportWizard projectId={id} defs={defs} />
      </Card>

      <Card>
        <CardHeader title="Son aktarımlar" />
        {history.length === 0 ? (
          <EmptyState title="Henüz aktarım yapılmadı" />
        ) : (
          <Table head={["Dosya", "Tür", "Satır", "Aktarılan", "Hatalı", "Durum", "Tarih"]}>
            {history.map((h) => (
              <tr key={h.id}>
                <td className={td + " font-medium"}>{h.file_name}</td>
                <td className={td}>{IMPORT_DEFS[h.kind as keyof typeof IMPORT_DEFS]?.title ?? h.kind}</td>
                <td className={tdNum}>{h.total_rows ?? "—"}</td>
                <td className={tdNum}>{h.success_rows ?? "—"}</td>
                <td className={tdNum}>{h.error_rows ?? "—"}</td>
                <td className={td}>
                  <Badge tone={h.status === "completed" ? "success" : h.status === "failed" ? "danger" : "warning"}>
                    {h.status === "completed" ? "Tamamlandı" : h.status === "failed" ? "Başarısız" : "İşleniyor"}
                  </Badge>
                </td>
                <td className={td}>{formatDateTime(h.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
