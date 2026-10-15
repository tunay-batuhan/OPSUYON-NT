import Link from "next/link";
import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Stat, Table, cn, td, tdNum } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Cari Hesap" };

type Stmt = { project_id: string; file_name: string; row_count: number; closing_balance: number; as_of_date: string | null; created_at: string };

/** Her projenin güncel cari bakiyesi = yüklenen Excel ekstresinin SON satırı. */
export default async function LedgerAllPage() {
  await requireUser();
  const projects = await getAccessibleProjects();
  const supabase = await createClient();
  const { data } = await supabase
    .from("ledger_statements")
    .select("project_id, file_name, row_count, closing_balance, as_of_date, created_at")
    .eq("is_current", true)
    .limit(500);
  const byProject = new Map(((data ?? []) as Stmt[]).map((s) => [s.project_id, s]));
  const list = projects.map((p) => ({ project: p, stmt: byProject.get(p.id) })).filter((r) => r.stmt);
  const total = list.reduce((a, r) => a + Number(r.stmt!.closing_balance), 0);

  return (
    <>
      <PageHeader title="Cari Hesap" description="Proje bazında güncel cari bakiye. Bakiye, muhasebenin yüklediği ekstrenin son satırından alınır." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label="Genel bakiye" value={formatMoney(total)} hint={total > 0 ? "Ödenecek" : total < 0 ? "Alacak" : "Bakiye yok"} icon={Wallet} tone={total > 0 ? "rose" : "emerald"} />
        <Stat label="Ekstresi olan proje" value={list.length} hint={`${projects.length} projeden`} icon={Wallet} tone="blue" />
      </div>
      <Card>
        <CardHeader title="Projeler" description="Ayrıntılı ekstre için projeye tıklayın." />
        {list.length === 0 ? (
          <EmptyState title="Görüntülenecek cari hesap yok" description="Merkez cari ekstresini yüklediğinde burada görünür." />
        ) : (
          <Table numeric={[4]} head={["Proje", "Firma", "Ekstre tarihi", "Son güncelleme", "Güncel bakiye"]}>
            {list.map(({ project, stmt }) => (
              <tr key={project.id}>
                <td className={td}><Link href={`/projeler/${project.id}/finans`} className="font-medium hover:text-brand">{project.name}</Link></td>
                <td className={td}>{project.organizations?.name}</td>
                <td className={td}>{formatDate(stmt!.as_of_date)}</td>
                <td className={td}>{formatDateTime(stmt!.created_at)}</td>
                <td className={cn(tdNum, "font-semibold", Number(stmt!.closing_balance) > 0 ? "text-danger" : "text-success")}>{formatMoney(stmt!.closing_balance)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
