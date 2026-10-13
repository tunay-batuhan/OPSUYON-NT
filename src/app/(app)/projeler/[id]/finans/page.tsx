import { notFound } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, cn, td, tdNum } from "@/components/ui";
import { InvoiceForm, PaymentForm } from "@/components/forms/ops-forms";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Payment, StatementRow } from "@/lib/types";
import { deletePayment, setInvoiceStatus } from "@/app/actions/finance";

const invTone = { draft: "warning", issued: "success", cancelled: "neutral" } as const;
const invLabel = { draft: "Taslak", issued: "Kesildi", cancelled: "İptal" } as const;

export default async function FinancePage({ params }: PageProps<"/projeler/[id]/finans">) {
  const { id } = await params;
  const ctx = await getProjectContext(id);
  const manage = can(ctx, "finance.manage");
  const canInv = manage || can(ctx, "invoices.read");
  const canPay = manage || can(ctx, "payments.read");
  const canLedger = can(ctx, "ledger.read");
  if (!canInv && !canPay && !canLedger) notFound();

  const supabase = await createClient();
  const [inv, pay, led] = await Promise.all([
    canInv ? supabase.from("invoices").select("*").eq("project_id", id).order("issue_date", { ascending: false }) : null,
    canPay ? supabase.from("payments").select("*").eq("project_id", id).order("paid_on", { ascending: false }) : null,
    canLedger ? supabase.rpc("account_statement", { p_project_id: id }) : null,
  ]);
  const invoices = (inv?.data ?? []) as Invoice[];
  const payments = (pay?.data ?? []) as Payment[];
  const statement = (led?.data ?? []) as StatementRow[];
  const balance = statement.at(-1)?.balance ?? 0;

  // invoice → attached document (PDF) lookups
  const docIds = invoices.map((i) => i.document_id).filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {canLedger && (
        <Card>
          <CardHeader
            title="Cari hesap"
            description="Kesilen faturalar borç, yapılan ödemeler alacak olarak işlenir."
            action={
              <div className="text-right">
                <p className="text-xs text-muted">Güncel bakiye</p>
                <p className={cn("text-xl font-semibold tabular-nums", balance > 0 ? "text-danger" : "text-success")}>
                  {formatMoney(balance)}
                </p>
              </div>
            }
          />
          {statement.length === 0 ? (
            <EmptyState title="Henüz hareket yok" />
          ) : (
            <Table head={["Tarih", "Tür", "Belge / referans", "Borç", "Alacak", "Bakiye"]}>
              {statement.map((r, i) => (
                <tr key={i}>
                  <td className={td}>{formatDate(r.entry_date)}</td>
                  <td className={td}><Badge tone={r.kind === "fatura" ? "brand" : "success"}>{r.kind === "fatura" ? "Fatura" : "Ödeme"}</Badge></td>
                  <td className={td}>{r.ref_no}</td>
                  <td className={tdNum}>{Number(r.debit) ? formatMoney(r.debit) : ""}</td>
                  <td className={tdNum}>{Number(r.credit) ? formatMoney(r.credit) : ""}</td>
                  <td className={cn(tdNum, "font-medium")}>{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {canInv && (
        <Card>
          <CardHeader title="Aylık faturalar" />
          {invoices.length === 0 ? (
            <EmptyState title="Fatura bulunmuyor" />
          ) : (
            <Table head={["Fatura no", "Dönem", "Tarih", "Vade", "Ara toplam", "KDV", "Toplam", "Durum", ""]}>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className={cn(td, "font-medium")}>{i.invoice_no}</td>
                  <td className={td}>{formatPeriod(i.period_year, i.period_month)}</td>
                  <td className={td}>{formatDate(i.issue_date)}</td>
                  <td className={td}>{formatDate(i.due_date)}</td>
                  <td className={tdNum}>{formatMoney(i.subtotal, i.currency)}</td>
                  <td className={tdNum}>{formatMoney(i.vat_amount, i.currency)}</td>
                  <td className={cn(tdNum, "font-medium")}>{formatMoney(i.total, i.currency)}</td>
                  <td className={td}><Badge tone={invTone[i.status]}>{invLabel[i.status]}</Badge></td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    {i.document_id && docIds.includes(i.document_id) && (
                      <a href={`/api/documents/${i.document_id}`} className="mr-2 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                        <Download className="size-4" aria-hidden /> PDF
                      </a>
                    )}
                    {manage && i.status !== "cancelled" && (
                      <form action={setInvoiceStatus} className="inline">
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="status" value={i.status === "draft" ? "issued" : "cancelled"} />
                        <button className="text-sm text-muted hover:text-fg">{i.status === "draft" ? "Yayınla" : "İptal et"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {canPay && (
        <Card>
          <CardHeader title="Ödemeler" />
          {payments.length === 0 ? (
            <EmptyState title="Ödeme kaydı bulunmuyor" />
          ) : (
            <Table head={["Tarih", "Tutar", "Yöntem", "Referans", "Not", manage ? "" : null].filter((h) => h !== null)}>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className={td}>{formatDate(p.paid_on)}</td>
                  <td className={cn(td, "font-medium tabular-nums")}>{formatMoney(p.amount, p.currency)}</td>
                  <td className={cn(td, "capitalize")}>{p.method?.replace("_", " ") ?? "—"}</td>
                  <td className={td}>{p.reference ?? "—"}</td>
                  <td className={cn(td, "text-muted")}>{p.notes ?? ""}</td>
                  {manage && (
                    <td className={td}>
                      <form action={deletePayment}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <button className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label="Ödemeyi sil">
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {manage && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Fatura ekle" description="KDV tutarı ve genel toplam otomatik hesaplanır." />
            <InvoiceForm projectId={id} />
          </Card>

          <Card>
            <CardHeader title="Ödeme ekle" />
            <PaymentForm projectId={id} invoices={invoices.filter((i) => i.status === "issued").map((i) => ({ value: i.id, label: i.invoice_no }))} />
          </Card>
        </div>
      )}
    </div>
  );
}
