// Bordro ve maaş (16 Kasım): avans, ücret tanımı ve ay sonu satırları. Tarayıcıda (react-hook-form) ve sunucuda
// (action içinde) AYNI şema çalışır. Tutarları istemci göndermez: hesap veritabanında (payroll_lines tetikleyicisi).
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
  overtime_monthly: money("Aylık net fazla mesai", { min: 0, max: MAX_AMOUNT }),
  meal_monthly: money("Aylık yemek kartı", { min: 0, max: MAX_AMOUNT }),
  extra_monthly: money("Ek ödeme", { min: 0, max: MAX_AMOUNT }),
  extra_label: opt("Ek ödeme adı", 60),
});
export type PayRatesValues = z.infer<typeof payRatesSchema>;

/** Ay sonu tablosundaki bir satırın girilebilen alanları (müşteri: gün alanları; merkez: kesintiler de). */
export const lineEditSchema = z.object({
  id: uuid("Satır"),
  missing_days: z.number().min(0).max(30).multipleOf(0.5),
  ihbar_deduction: z.number().min(0).max(MAX_AMOUNT).optional(),
  bes_deduction: z.number().min(0).max(MAX_AMOUNT).optional(),
  other_deduction: z.number().min(0).max(MAX_AMOUNT).optional(),
  other_note: z.string().trim().max(200).optional(),
});
export const linesSaveSchema = z.object({
  run_id: uuid("Dönem"),
  rows: z.array(lineEditSchema).min(1, "Değişiklik yok").max(1000),
});
export type LineEdit = z.infer<typeof lineEditSchema>;
export type LinesSaveValues = z.infer<typeof linesSaveSchema>;
