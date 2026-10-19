import Link from "next/link";
import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Stat, Table, cn, td, tdNum } from "@/components/ui";
import { PdfIcon } from "@/components/doc-ui";
import { getAccessibleProjects } from "@/lib/lookups";
import { requireAccess } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Cari Hesap" };

type Stmt = { project_id: string; closing_balance: number; as_of_date: string | null; created_at: string };
type Ekstre = { id: string; project_id: string; title: string; created_at: string };

/** Cari Hesap: her projenin SON yüklenen cari ekstresi (PDF indirilebilir) ve güncel bakiyesi. */
export default async function LedgerAllPage() {
  await requireAccess("cari_hesap", "ledger.read");
  const projects = await getAccessibleProjects();
  const supabase = await createClient();

  const [{ data: stmts }, { data: docs }] = await Promise.all([
    supabase.from("ledger_statements").select("project_id, closing_balance, as_of_date, created_at").eq("is_current", true).limit(500),
    supabase.from("documents").select("id, project_id, title, created_at").eq("category_code", "cari_ekstre").order("created_at", { ascending: false }).limit(500),
  ]);
  const stmtOf = new Map(((stmts ?? []) as Stmt[]).map((s) => [s.project_id, s]));
  const latestPdf = new Map<string, Ekstre>();
  for (const d of (docs ?? []) as Ekstre[]) if (!latestPdf.has(d.project_id)) latestPdf.set(d.project_id, d);

  const list = projects
    .map((p) => ({ project: p, stmt: stmtOf.get(p.id), pdf: latestPdf.get(p.id) }))
    .filter((r) => r.stmt || r.pdf);
  const withBalance = list.filter((r) => r.stmt);
  const total = withBalance.reduce((a, r) => a + Number(r.stmt!.closing_balance), 0);

  return (
    <>
      <PageHeader title="Cari Hesap" description="Son yüklenen cari ekstre ve güncel bakiye. Ekstreyi PDF olarak indirebilirsiniz." />
      {withBalance.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Stat label="Genel bakiye" value={formatMoney(total)} hint={total > 0 ? "Ödenecek" : total < 0 ? "Alacak" : "Bakiye yok"} icon={Wallet} tone={total > 0 ? "rose" : "emerald"} />
          <Stat label="Ekstresi olan proje" value={list.length} hint={`${projects.length} projeden`} icon={Wallet} tone="blue" />
        </div>
      )}
      <Card>
        <CardHeader title="Cari ekstre" description="Faturalar için Cari Hesap → Faturalar." />
        {list.length === 0 ? (
          <EmptyState title="Henüz cari ekstre yüklenmemiş" description="Ekstre yüklendiğinde burada görünür." />
        ) : (
          <Table numeric={[3]} head={["Proje", "Firma", "Ekstre tarihi", "Güncel bakiye", "Ekstre (PDF)"]}>
            {list.map(({ project, stmt, pdf }) => (
              <tr key={project.id}>
                <td className={td}>
                  <Link href={`/projeler/${project.id}/finans`} className="font-medium hover:text-brand">{project.name}</Link>
                </td>
                <td className={td}>{project.organizations?.name}</td>
                <td className={td}>{formatDate(stmt?.as_of_date ?? pdf?.created_at)}<span className="block text-xs text-muted">{formatDateTime(pdf?.created_at ?? stmt?.created_at)}</span></td>
                <td className={cn(tdNum, "font-semibold", stmt && Number(stmt.closing_balance) > 0 ? "text-danger" : "text-success")}>{stmt ? formatMoney(stmt.closing_balance) : "—"}</td>
                <td className={td}>{pdf ? <PdfIcon id={pdf.id} title={pdf.title} /> : <span className="text-sm text-muted">PDF yüklenmemiş</span>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
