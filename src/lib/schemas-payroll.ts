// Bordro ve maaş (16 Kasım): avans, ücret tanımı ve ay sonu satırları. Tarayıcıda (react-hook-form) ve sunucuda
// (action içinde) AYNI şema çalışır. Tutarları istemci göndermez: sunucu, dönemin şablonuyla (lib/payroll-engine.ts) hesaplar.
import { z } from "zod";
import { date, money, opt, uuid } from "@/lib/schemas";

/** numeric(12,2) üst sınırı (ekranda makul sınır) */
const MAX_AMOUNT = 9_999_999;

export const advanceSchema = z.object({
  project_id: uuid("Proje"),
  personnel_id: uuid("Personel"),
  paid_on: date("Ödeme tarihi", true),
  amount: money("Tutar", { required: true, min: 0.01, max: MAX_AMOUNT }),
  note: opt("Açıklama", 300),
});
export type AdvanceValues = z.infer<typeof advanceSchema>;

export const payRatesSchema = z.object({
  personnel_id: uuid("Personel"),
  net_salary: money("Net maaş", { required: true, min: 0, max: MAX_AMOUNT }),
  transport_monthly: money("Aylık net yol", { min: 0, max: MAX_AMOUNT }),
  support_monthly: money("Aylık destek ödeme", { min: 0, max: MAX_AMOUNT }),
  meal_monthly: money("Aylık ticket / yemek kartı", { min: 0, max: MAX_AMOUNT }),
  overtime_monthly: money("Aylık net fazla mesai", { min: 0, max: MAX_AMOUNT }),
  extra_monthly: money("Ek ödeme", { min: 0, max: MAX_AMOUNT }),
  extra_label: opt("Ek ödeme adı", 60),
  bes_monthly: money("Aylık BES", { min: 0, max: MAX_AMOUNT }),
});
export type PayRatesValues = z.infer<typeof payRatesSchema>;

/** Maaş tablosunda bir satırın hücreleri: { sütun kodu: sayı | metin | null (formüle dön / boşalt) }. */
export const lineCellsSchema = z.object({
  id: uuid("Satır"),
  cells: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,29}$/), z.union([z.number().min(-99_999_999).max(99_999_999), z.string().max(120), z.null()])),
});
export const linesSaveSchema = z.object({
  run_id: uuid("Dönem"),
  rows: z.array(lineCellsSchema).min(1, "Değişiklik yok").max(1000),
});
export type LineCells = z.infer<typeof lineCellsSchema>;
export type LinesSaveValues = z.infer<typeof linesSaveSchema>;
