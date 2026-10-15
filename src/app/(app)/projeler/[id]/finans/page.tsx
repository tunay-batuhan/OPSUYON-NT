import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, btn, cn, td, tdNum } from "@/components/ui";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { StatementRow } from "@/lib/types";

type Stmt = { id: string; file_name: string; row_count: number; closing_balance: number; as_of_date: string | null; is_current: boolean; created_at: string };

/** Cari hesap: muhasebenin yüklediği Excel ekstresi. Son satırın bakiyesi güncel bakiyedir. */
export default async function LedgerPage({ params }: PageProps<"/projeler/[id]/finans">) {
  const { id } = await params;
  const ctx = await getProjectContext(id);
  const manage = can(ctx, "finance.manage");
  if (!can(ctx, "ledger.read") && !manage) notFound();

  const supabase = await createClient();
  const [{ data: stmts }, { data: rows }] = await Promise.all([
    supabase.from("ledger_statements").select("id, file_name, row_count, closing_balance, as_of_date, is_current, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(10),
    can(ctx, "ledger.read") ? supabase.rpc("account_statement", { p_project_id: id }) : Promise.resolve({ data: [] }),
  ]);
  const statements = (stmts ?? []) as Stmt[];
  const current = statements.find((s) => s.is_current);
  const statement = (rows ?? []) as StatementRow[];
  const balance = Number(current?.closing_balance ?? statement.at(-1)?.balance ?? 0);
  const totalDebit = statement.reduce((a, r) => a + Number(r.debit), 0);
  const totalCredit = statement.reduce((a, r) => a + Number(r.credit), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Güncel cari bakiye"
          description={current ? `Ekstrenin son satırı · ${formatDate(current.as_of_date)} · yükleme: ${formatDateTime(current.created_at)}` : "Henüz cari hesap ekstresi yüklenmemiş."}
          action={manage && (
            <Link href={`/projeler/${id}/aktar?tur=ledger`} className={btn("primary", "sm")}>
              <Upload className="size-4" aria-hidden /> Ekstre yükle (Excel)
            </Link>
          )}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted">Güncel bakiye</p>
            <p className={cn("mt-1 text-3xl font-semibold tabular-nums", balance > 0 ? "text-danger" : "text-success")}>{formatMoney(balance)}</p>
            <p className="text-xs text-muted">{balance > 0 ? "Ödenecek tutar" : balance < 0 ? "Alacak" : "Bakiye yok"}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Toplam borç (fatura)</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(totalDebit)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Toplam alacak (ödeme)</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(totalCredit)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Cari hesap ekstresi" description={current ? `${current.file_name} · ${current.row_count} satır` : undefined} />
        {statement.length === 0 ? (
          <EmptyState
            title="Ekstre bulunmuyor"
            description={manage ? "Muhasebenin hazırladığı Excel cari ekstresini yükleyin; son satırdaki bakiye güncel bakiye olur." : "Merkez cari ekstresini yüklediğinde burada görünür."}
          />
        ) : (
          <Table numeric={[4, 5, 6]} head={["Tarih", "Tür", "Belge no", "Açıklama", "Borç", "Alacak", "Bakiye"]}>
            {statement.map((r, i) => (
              <tr key={i} className={i === statement.length - 1 ? "bg-brand-soft/40 font-medium" : undefined}>
                <td className={td}>{formatDate(r.entry_date)}</td>
                <td className={td}><Badge tone={r.kind === "fatura" ? "brand" : "success"}>{r.kind === "fatura" ? "Borç" : "Alacak"}</Badge></td>
                <td className={td}>{r.ref_no ?? "—"}</td>
                <td className={cn(td, "text-muted")}>{r.description ?? ""}</td>
                <td className={tdNum}>{Number(r.debit) ? formatMoney(r.debit) : ""}</td>
                <td className={tdNum}>{Number(r.credit) ? formatMoney(r.credit) : ""}</td>
                <td className={cn(tdNum, "font-semibold")}>{formatMoney(r.balance)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {manage && statements.length > 1 && (
        <Card>
          <CardHeader title="Önceki ekstreler" description="Yeni ekstre yüklendiğinde öncekiler arşivlenir." />
          <ul className="divide-y divide-border text-sm">
            {statements.filter((s) => !s.is_current).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="flex items-center gap-2"><FileSpreadsheet className="size-4 text-muted" aria-hidden /> {s.file_name}</span>
                <span className="text-muted">{formatDateTime(s.created_at)} · bakiye {formatMoney(s.closing_balance)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
