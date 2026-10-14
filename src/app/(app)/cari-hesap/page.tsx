import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardHeader, EmptyState, PageHeader, Stat, Table, cn, td, tdNum } from "@/components/ui";
import { Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import type { StatementRow } from "@/lib/types";

export const metadata: Metadata = { title: "Cari Hesap" };

export default async function LedgerAllPage() {
  await requireUser();
  const projects = await getAccessibleProjects();
  const supabase = await createClient();

  // Ledger permission is per project: ask for each one and keep the ones that answer.
  const results = await Promise.all(
    projects.slice(0, 100).map(async (p) => {
      const { data, error } = await supabase.rpc("account_statement", { p_project_id: p.id });
      if (error) return null;
      const rows = (data ?? []) as StatementRow[];
      return {
        project: p,
        invoiced: rows.reduce((a, r) => a + Number(r.debit), 0),
        paid: rows.reduce((a, r) => a + Number(r.credit), 0),
        balance: Number(rows.at(-1)?.balance ?? 0),
        movements: rows.length,
      };
    }),
  );
  const list = results.filter((r): r is NonNullable<typeof r> => r !== null);
  const total = list.reduce((a, r) => a + r.balance, 0);

  return (
    <>
      <PageHeader title="Cari Hesap" description="Proje bazında fatura, ödeme ve güncel bakiye." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Toplam fatura" value={formatMoney(list.reduce((a, r) => a + r.invoiced, 0))} icon={Wallet} tone="blue" />
        <Stat label="Toplam ödeme" value={formatMoney(list.reduce((a, r) => a + r.paid, 0))} icon={Wallet} tone="emerald" />
        <Stat label="Genel bakiye" value={formatMoney(total)} hint={total > 0 ? "Ödenecek" : total < 0 ? "Alacak" : "Bakiye yok"} icon={Wallet} tone={total > 0 ? "rose" : "emerald"} />
      </div>
      <Card>
        <CardHeader title="Projeler" description="Ayrıntılı ekstre için projeye tıklayın." />
        {list.length === 0 ? (
          <EmptyState title="Görüntülenecek cari hesap yok" />
        ) : (
          <Table head={["Proje", "Firma", "Fatura", "Ödeme", "Bakiye"]}>
            {list.map((r) => (
              <tr key={r.project.id}>
                <td className={td}><Link href={`/projeler/${r.project.id}/finans`} className="font-medium hover:text-brand">{r.project.name}</Link></td>
                <td className={td}>{r.project.organizations?.name}</td>
                <td className={tdNum}>{formatMoney(r.invoiced)}</td>
                <td className={tdNum}>{formatMoney(r.paid)}</td>
                <td className={cn(tdNum, "font-semibold", r.balance > 0 ? "text-danger" : "text-success")}>{formatMoney(r.balance)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
