import type { Metadata } from "next";
import { Banknote, CreditCard, FileDown, Wallet } from "lucide-react";
import { requirePersonnel } from "@/lib/auth";
import { LINE_COLUMNS, dayFmt, numify, periodLabel, tl, type PayrollLineRow } from "@/lib/payroll-shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, isoDayInTurkey } from "@/lib/format";

export const metadata: Metadata = { title: "Bordrolarım" };

type Run = { id: string; period_year: number; period_month: number; status: string; projects: { name: string } | null };
type Advance = { id: string; paid_on: string; amount: number; note: string | null };

/**
 * Personelin kendi bordroları: yalnızca ONAYLANMIŞ dönemler, en yenisi üstte; her biri için net ödenen, bankadan ve
 * yemek kartına ödenen ve bordro PDF'i. Altta son 6 ayın avansları. Personel hesabı RLS ile bordro tablolarını
 * okuyamaz: veriler servis anahtarıyla, yalnızca oturumdaki personelin kimliğiyle süzülerek okunur.
 */
export default async function MyPayslipsPage() {
  const me = await requirePersonnel();
  const admin = createAdminClient();

  const sixMonthsAgo = isoDayInTurkey(-183);
  const [{ data: lineRows }, { data: advRows }] = await Promise.all([
    admin.from("payroll_lines").select(LINE_COLUMNS).eq("personnel_id", me.personnel_id).limit(120),
    admin.from("pay_advances").select("id, paid_on, amount, note").eq("personnel_id", me.personnel_id).gte("paid_on", sixMonthsAgo).order("paid_on", { ascending: false }).limit(100),
  ]);
  const lines = ((lineRows ?? []) as unknown as PayrollLineRow[]).map(numify);
  const runIds = [...new Set(lines.map((l) => l.run_id))];
  const { data: runRows } = runIds.length
    ? await admin.from("payroll_runs").select("id, period_year, period_month, status, projects(name)").in("id", runIds).eq("status", "approved")
    : { data: [] };
  const runOf = new Map(((runRows ?? []) as unknown as Run[]).map((r) => [r.id, r]));
  const slips = lines
    .filter((l) => runOf.has(l.run_id))
    .map((l) => ({ l, r: runOf.get(l.run_id)! }))
    .sort((a, b) => b.r.period_year * 100 + b.r.period_month - (a.r.period_year * 100 + a.r.period_month));
  const advances = (advRows ?? []) as Advance[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bordrolarım</h1>
        <p className="mt-1 text-sm text-muted">Onaylanan maaş bordrolarınız. PDF olarak indirebilirsiniz.</p>
      </div>

      {slips.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
          <Banknote className="mx-auto size-8 text-muted" aria-hidden />
          <p className="mt-3 font-semibold">Henüz onaylanmış bordronuz yok</p>
          <p className="mt-1 text-sm text-muted">Ay sonu bordronuz onaylandığında burada görünür.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {slips.map(({ l, r }) => (
            <li key={l.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{periodLabel(r.period_year, r.period_month)}</p>
                  {r.projects?.name && <p className="truncate text-xs text-muted">{r.projects.name}</p>}
                </div>
                <a href={`/api/bordro/satir/${l.id}`} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg hover:bg-brand-hover">
                  <FileDown className="size-5" aria-hidden /> Bordro PDF
                </a>
              </div>
              <div className="px-4 py-4">
                <p className="text-xs uppercase tracking-wide text-muted">Net ödenen</p>
                <p className={`text-3xl font-bold tabular-nums ${l.net_paid < 0 ? "text-danger" : "text-navy"}`}>{tl(l.net_paid)} ₺</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-brand-soft px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-brand"><Wallet className="size-4" aria-hidden /> Bankadan</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums">{tl(l.bank_paid)} ₺</p>
                  </div>
                  <div className="rounded-xl bg-success-soft px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-success"><CreditCard className="size-4" aria-hidden /> Yemek kartına</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums">{tl(l.meal_card_paid)} ₺</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted">Çalışılan gün</dt>
                  <dd className="text-right tabular-nums">{dayFmt(l.worked_days)}</dd>
                  <dt className="text-muted">Kazanç toplamı</dt>
                  <dd className="text-right tabular-nums">{tl(l.earnings_total)} ₺</dd>
                  <dt className="text-muted">Avans</dt>
                  <dd className="text-right tabular-nums">{tl(l.advance_total)} ₺</dd>
                  <dt className="text-muted">Kesinti toplamı</dt>
                  <dd className="text-right tabular-nums">{tl(l.deductions_total)} ₺</dd>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="avans-baslik" className="rounded-2xl border border-border bg-surface shadow-card">
        <h2 id="avans-baslik" className="border-b border-border px-4 py-3 font-semibold">Avanslarım (son 6 ay)</h2>
        {advances.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">Son 6 ayda avans kaydı yok.</p>
        ) : (
          <ul className="divide-y divide-border">
            {advances.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-medium">{formatDate(a.paid_on)}</span>
                  {a.note && <span className="block truncate text-xs text-muted">{a.note}</span>}
                </span>
                <span className="shrink-0 text-base font-semibold tabular-nums">{tl(Number(a.amount))} ₺</span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-border px-4 py-3 text-xs text-muted">Avanslar, verildiği ayın maaşından düşülür.</p>
      </section>
    </div>
  );
}
