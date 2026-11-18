"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, FileDown, Loader2, Save, Undo2 } from "lucide-react";
import { savePayrollLines } from "@/app/actions/payroll";
import { toNumber } from "@/lib/parse";
import { dayFmt, sumLines, tl, type PayrollLineView } from "@/lib/payroll-shared";
import type { LineEdit } from "@/lib/schemas-payroll";
import { btn, cn } from "@/components/ui";
import { ActionResult } from "./action-result";
import { useAction } from "./use-action";

type Field = "missing_days" | "ihbar_deduction" | "bes_deduction" | "other_deduction";
const DAY_FIELDS: Field[] = ["missing_days"];
const DED_FIELDS: Field[] = ["ihbar_deduction", "bes_deduction", "other_deduction"];
const MAX: Record<Field, number> = { missing_days: 30, ihbar_deduction: 9_999_999, bes_deduction: 9_999_999, other_deduction: 9_999_999 };

/** Kutudaki metin → sayı (gün alanları yarım gün olabilir); geçersizse null. */
function parse(field: Field, text: string): number | null {
  const n = toNumber(text === "" ? "0" : text);
  if (n === null || n < 0 || n > MAX[field]) return null;
  if (DAY_FIELDS.includes(field)) return Number.isInteger(n * 2) ? n : null;
  return Math.round(n * 100) / 100;
}
const show = (field: Field, n: number) => (DAY_FIELDS.includes(field) ? dayFmt(n) : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n));

const th = "whitespace-nowrap px-3 py-2 text-right font-medium";
const tdN = "whitespace-nowrap px-3 py-2 text-right tabular-nums";

/**
 * Ay sonu bordro tablosu (müşterinin Excel düzeni): personel başına eksik gün (payroll.run) ve kesintiler
 * (yalnızca merkez) girilir; maaş, yol, fazla mesai ve yemek kartı aylık tanımdan ÷ 30 × çalışılan gün hesaplanır; tutarları veritabanı hesaplar. "Kaydet ve hesapla"
 * yalnızca değişen satırları gönderir, sonra tablo yeni tutarlarla yenilenir.
 */
export function PayrollTable({
  runId, lines, editDays, editDeductions,
}: { runId: string; lines: PayrollLineView[]; editDays: boolean; editDeductions: boolean }) {
  const [edits, setEdits] = useState<Record<string, Partial<Record<Field, string>>>>({});
  const { pending, result, run } = useAction();
  const totals = useMemo(() => sumLines(lines), [lines]);

  const value = (l: PayrollLineView, f: Field) => edits[l.id]?.[f] ?? show(f, Number(l[f]));
  const isDirty = (l: PayrollLineView) =>
    Object.entries(edits[l.id] ?? {}).some(([f, t]) => {
      const n = parse(f as Field, t ?? "");
      return n === null || n !== Number(l[f as Field]);
    });
  const isInvalid = (l: PayrollLineView, f: Field) => {
    const t = edits[l.id]?.[f];
    return t !== undefined && parse(f, t) === null;
  };
  const dirty = lines.filter(isDirty);
  const invalid = lines.some((l) => [...DAY_FIELDS, ...DED_FIELDS].some((f) => isInvalid(l, f)));

  const set = (id: string, f: Field, t: string) => setEdits((e) => ({ ...e, [id]: { ...e[id], [f]: t } }));

  function save() {
    const rows: LineEdit[] = dirty.map((l) => {
      const n = (f: Field) => parse(f, value(l, f)) ?? Number(l[f]);
      const row: LineEdit = { id: l.id, missing_days: n("missing_days") };
      if (editDeductions) {
        row.ihbar_deduction = n("ihbar_deduction");
        row.bes_deduction = n("bes_deduction");
        row.other_deduction = n("other_deduction");
      }
      return row;
    });
    run(() => savePayrollLines({ run_id: runId, rows }), () => setEdits({}));
  }

  const input = (l: PayrollLineView, f: Field, editable: boolean, label: string) =>
    editable ? (
      <input
        aria-label={`${l.full_name} — ${label}`}
        inputMode="decimal"
        value={value(l, f)}
        onChange={(e) => set(l.id, f, e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "h-8 w-[4.5rem] rounded-md border bg-surface px-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
          DED_FIELDS.includes(f) && "w-24",
          isInvalid(l, f) ? "border-danger bg-danger-soft/40" : "border-border",
        )}
      />
    ) : (
      <span>{DAY_FIELDS.includes(f) ? dayFmt(Number(l[f])) : tl(Number(l[f]))}</span>
    );

  const editable = editDays || editDeductions;

  return (
    <div>
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-sm text-muted">
            {dirty.length
              ? `${dirty.length} satırda kaydedilmemiş değişiklik var; tutarlar kaydedince yeniden hesaplanır.`
              : editDeductions
                ? "Eksik gün ve kesintileri girin. Maaş, yol, fazla mesai ve yemek kartı eksik gün kadar orantılı düşer."
                : "Eksik günleri girin. Maaş, yol, fazla mesai ve yemek kartı eksik gün kadar orantılı düşer."}
          </p>
          <div className="flex items-center gap-2">
            {dirty.length > 0 && (
              <button type="button" onClick={() => setEdits({})} disabled={pending} className={btn("ghost", "sm")}>
                <Undo2 className="size-4" aria-hidden /> Vazgeç
              </button>
            )}
            <button type="button" onClick={save} disabled={pending || !dirty.length || invalid} className={btn("primary", "md")}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />} Kaydet ve hesapla
            </button>
          </div>
        </div>
      )}
      {result && <ActionResult result={result} className="mx-5 mt-3" />}

      {/* relative: tablodaki ekran okuyucu etiketleri (sr-only) kaydırma kutusundan taşıp sayfayı genişletmesin */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-[11px] uppercase tracking-wide text-muted">
              <th colSpan={6} className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left font-semibold">Personel ve günler</th>
              <th colSpan={6} className="border-l border-border px-3 py-2 text-center font-semibold">Kazançlar</th>
              <th colSpan={5} className="border-l border-border px-3 py-2 text-center font-semibold">Kesintiler</th>
              <th colSpan={4} className="border-l border-border px-3 py-2 text-center font-semibold">Ödeme</th>
            </tr>
            <tr className="border-b border-border bg-surface-2/60 text-xs text-muted">
              <th className="sticky left-0 z-10 min-w-48 bg-surface-2 px-3 py-2 text-left font-medium">Ad soyad</th>
              <th className={th}>Net maaş</th>
              <th className={th}>Eksik gün</th>
              <th className={th}>Çalışılan</th>
              <th className={cn(th, "border-l border-border")}>Normal</th>
              <th className={th}>Yol</th>
              <th className={th}>F. mesai</th>
              <th className={th}>Yemek kartı</th>
              <th className={th}>Ek ödeme</th>
              <th className={th}>Kazanç top.</th>
              <th className={cn(th, "border-l border-border")}>Avans</th>
              <th className={th}>İhbar</th>
              <th className={th}>BES</th>
              <th className={th}>Diğer</th>
              <th className={th}>Kesinti top.</th>
              <th className={cn(th, "border-l border-border")}>Bankadan</th>
              <th className={th}>Yemek kartına</th>
              <th className={th}>Net ödenen</th>
              <th className="px-3 py-2"><span className="sr-only">Bordro PDF</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l) => {
              const d = isDirty(l);
              return (
                <tr key={l.id} className={cn(d && "bg-warning-soft/40")}>
                  <td className={cn("sticky left-0 z-10 px-3 py-2", d ? "bg-[color-mix(in_oklab,var(--warning-soft)_40%,var(--surface))]" : "bg-surface")}>
                    <p className="font-medium">{l.full_name}</p>
                    {l.has_rates ? (
                      l.title && <p className="text-xs text-muted">{l.title}</p>
                    ) : (
                      <Link href="/bordrolar/ucretler" className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger hover:underline">
                        <AlertTriangle className="size-3" aria-hidden /> Ücret tanımı yok
                      </Link>
                    )}
                  </td>
                  <td className={cn(tdN, "text-muted")}>{tl(l.net_salary)}</td>
                  <td className={tdN}>{input(l, "missing_days", editDays, "Eksik gün")}</td>
                  <td className={tdN}>{dayFmt(l.worked_days)}</td>
                  <td className={cn(tdN, "border-l border-border")}>{tl(l.normal_pay)}</td>
                  <td className={tdN}>{tl(l.transport_pay)}</td>
                  <td className={tdN}>{tl(l.overtime_pay)}</td>
                  <td className={tdN}>{tl(l.meal_pay)}</td>
                  <td className={tdN} title={l.extra_label ?? undefined}>
                    {tl(l.extra_pay)}
                    {l.extra_label && l.extra_pay > 0 && <span className="block text-[11px] text-muted">{l.extra_label}</span>}
                  </td>
                  <td className={cn(tdN, "font-semibold")}>{tl(l.earnings_total)}</td>
                  <td className={cn(tdN, "border-l border-border")}>{tl(l.advance_total)}</td>
                  <td className={tdN}>{input(l, "ihbar_deduction", editDeductions, "İhbar kesintisi")}</td>
                  <td className={tdN}>{input(l, "bes_deduction", editDeductions, "BES kesintisi")}</td>
                  <td className={tdN} title={l.other_note ?? undefined}>{input(l, "other_deduction", editDeductions, "Diğer kesinti")}</td>
                  <td className={cn(tdN, "font-semibold")}>{tl(l.deductions_total)}</td>
                  <td className={cn(tdN, "border-l border-border", l.bank_paid < 0 && "font-semibold text-danger")}>{tl(l.bank_paid)}</td>
                  <td className={tdN}>{tl(l.meal_card_paid)}</td>
                  <td className={cn(tdN, "font-bold", l.net_paid < 0 && "text-danger")}>{tl(l.net_paid)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <a href={`/api/bordro/satir/${l.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline" aria-label={`${l.full_name} bordro PDF`}>
                      <FileDown className="size-3.5" aria-hidden /> PDF
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-2/60 font-semibold">
              <td className="sticky left-0 z-10 bg-surface-2 px-3 py-2.5">TOPLAM · {lines.length} kişi</td>
              <td colSpan={3} />
              <td className={cn(tdN, "border-l border-border")}>{tl(totals.normal_pay)}</td>
              <td className={tdN}>{tl(totals.transport_pay)}</td>
              <td className={tdN}>{tl(totals.overtime_pay)}</td>
              <td className={tdN}>{tl(totals.meal_pay)}</td>
              <td className={tdN}>{tl(totals.extra_pay)}</td>
              <td className={tdN}>{tl(totals.earnings_total)}</td>
              <td className={cn(tdN, "border-l border-border")}>{tl(totals.advance_total)}</td>
              <td className={tdN}>{tl(totals.ihbar_deduction)}</td>
              <td className={tdN}>{tl(totals.bes_deduction)}</td>
              <td className={tdN}>{tl(totals.other_deduction)}</td>
              <td className={tdN}>{tl(totals.deductions_total)}</td>
              <td className={cn(tdN, "border-l border-border")}>{tl(totals.bank_paid)}</td>
              <td className={tdN}>{tl(totals.meal_card_paid)}</td>
              <td className={tdN}>{tl(totals.net_paid)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
