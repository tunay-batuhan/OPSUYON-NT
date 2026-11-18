// Bordro ve maaş: istemci ve sunucunun ortak tipleri ve küçük yardımcıları (PDF, Excel, tablo aynı sütunları kullanır).
import { MONTHS } from "@/lib/format";

export type PayrollLineRow = {
  id: string;
  run_id: string;
  personnel_id: string;
  missing_days: number;
  overtime_days: number;
  meal_days: number;
  ihbar_deduction: number;
  bes_deduction: number;
  other_deduction: number;
  other_note: string | null;
  has_rates: boolean;
  net_salary: number;
  transport_monthly: number;
  overtime_daily: number;
  meal_daily: number;
  /** aylık net fazla mesai ve yemek kartı (18 Kasım'dan beri; ÷ 30 × çalışılan gün) */
  overtime_monthly: number;
  meal_monthly: number;
  extra_monthly: number;
  extra_label: string | null;
  worked_days: number;
  normal_pay: number;
  transport_pay: number;
  overtime_pay: number;
  meal_pay: number;
  extra_pay: number;
  earnings_total: number;
  advance_total: number;
  deductions_total: number;
  net_paid: number;
  meal_card_paid: number;
  bank_paid: number;
};

export type PayrollLineView = PayrollLineRow & { full_name: string; title: string | null };

/** Bir dönemin dışa aktarım / ekran verisi (PDF, Excel, sayfa). */
export type PayrollRunView = {
  id: string;
  project_id: string;
  org: string;
  project: string;
  year: number;
  month: number;
  status: "draft" | "approved";
  approvedAt: string | null;
  approvedBy: string | null;
  lines: PayrollLineView[];
};

export const LINE_COLUMNS =
  "id, run_id, personnel_id, missing_days, overtime_days, meal_days, ihbar_deduction, bes_deduction, other_deduction, other_note, has_rates, " +
  "net_salary, transport_monthly, overtime_daily, meal_daily, overtime_monthly, meal_monthly, extra_monthly, extra_label, worked_days, normal_pay, transport_pay, overtime_pay, " +
  "meal_pay, extra_pay, earnings_total, advance_total, deductions_total, net_paid, meal_card_paid, bank_paid";

/** PostgREST numeric sütunları sayı olarak döner; yine de metin gelirse sayıya çevrilir. */
export function numify<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && !["id", "run_id", "personnel_id", "other_note", "extra_label"].includes(k)) out[k] = Number(v);
  }
  return out as T;
}

export const periodLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;

/** Toplamı alınan tutar sütunları (tablo, PDF ve Excel'in TOPLAM satırı). */
export const SUM_KEYS = [
  "normal_pay", "transport_pay", "overtime_pay", "meal_pay", "extra_pay", "earnings_total", "advance_total",
  "ihbar_deduction", "bes_deduction", "other_deduction", "deductions_total", "bank_paid", "meal_card_paid", "net_paid",
] as const;
export type SumKey = (typeof SUM_KEYS)[number];

export function sumLines(lines: PayrollLineRow[]): Record<SumKey, number> {
  const t = Object.fromEntries(SUM_KEYS.map((k) => [k, 0])) as Record<SumKey, number>;
  for (const l of lines) for (const k of SUM_KEYS) t[k] = Math.round((t[k] + Number(l[k] ?? 0)) * 100) / 100;
  return t;
}

/** Türkçe sayı (2 ondalık): 28.075,50 */
export const tl = (n: number | null | undefined) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n ?? 0));

/** Gün: 30 · 1,5 */
export const dayFmt = (n: number | null | undefined) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(Number(n ?? 0));

/** Dosya adı için sade metin. */
export const fileSafe = (s: string) =>
  s
    .replaceAll("İ", "I").replaceAll("ı", "i").replaceAll("Ş", "S").replaceAll("ş", "s").replaceAll("Ğ", "G").replaceAll("ğ", "g")
    .replaceAll("Ü", "U").replaceAll("ü", "u").replaceAll("Ö", "O").replaceAll("ö", "o").replaceAll("Ç", "C").replaceAll("ç", "c")
    .replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "bordro";
