// Teklif modülü: tarayıcıda (react-hook-form) ve sunucuda (action içinde) AYNI şema çalışır.
import { z } from "zod";
import { date, decimal, email, money, opt, phone } from "@/lib/schemas";
import { toMoney, toNumber } from "@/lib/parse";
import type { OfferLineInput } from "@/lib/offer-calc";

/** numeric(14,2) üst sınırı */
const MAX_AMOUNT = 999_999_999_999;

const people = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,6}$/.test(v), "Kişi sayısı tam sayı olmalı");

export const offerLineSchema = z.object({
  service: z.string().trim().min(1, "Hizmet adı zorunlu").max(80, "Hizmet adı en fazla 80 karakter"),
  people,
  monthly_total: money("Aylık tutar", { min: 0, max: MAX_AMOUNT }),
});

export const offerSchema = z
  .object({
    id: z.string().refine((v) => v === "" || /^[0-9a-f-]{36}$/i.test(v), "Geçersiz teklif"),
    customer_name: z.string().trim().min(2, "Müşteri / site adı zorunlu").max(160, "En fazla 160 karakter"),
    contact_name: opt("Yetkili", 120),
    phone,
    email,
    address: opt("Adres", 400),
    notes: opt("Not", 2000),
    vat_rate: decimal("KDV oranı", { required: true, min: 0, max: 100 }),
    fee_per_person: money("Kişi başı teklif tutarı", { required: true, min: 0, max: 99_999_999 }),
    valid_until: date("Geçerlilik tarihi"),
    lines: z.array(offerLineSchema).min(1, "En az bir hizmet satırı girin").max(30, "En fazla 30 hizmet satırı"),
  })
  .refine((v) => offerLines(v.lines).some((l) => l.people > 0), { path: ["lines"], message: "En az bir hizmette kişi sayısı girin" });

export type OfferValues = z.infer<typeof offerSchema>;

export type OfferLineValues = z.infer<typeof offerLineSchema>;

/** Form satırları → hesap girdisi ("" → 0). */
export function offerLines(lines: OfferLineValues[]): OfferLineInput[] {
  return lines.map((l) => ({
    service: l.service.trim(),
    people: Number(l.people || 0),
    monthly_total: toMoney(l.monthly_total) ?? 0,
  }));
}

export const offerNumbers = (v: Pick<OfferValues, "vat_rate" | "fee_per_person">) => ({
  vat: toNumber(v.vat_rate) ?? 0,
  fee: toMoney(v.fee_per_person) ?? 0,
});

export const offerSettingsSchema = z.object({
  fee_per_person: money("Kişi başı teklif tutarı", { required: true, min: 0, max: 99_999_999 }),
  vat_rate: decimal("KDV oranı", { required: true, min: 0, max: 100 }),
  validity_days: decimal("Geçerlilik süresi", { required: true, min: 1, max: 365 }).refine((v) => Number.isInteger(toNumber(v)), "Gün sayısı tam sayı olmalı"),
  services: z
    .string()
    .max(2000, "Liste çok uzun")
    .refine((v) => serviceList(v).length > 0, "En az bir hizmet adı yazın")
    .refine((v) => serviceList(v).every((s) => s.length <= 80), "Her hizmet adı en fazla 80 karakter"),
});

export type OfferSettingsValues = z.infer<typeof offerSettingsSchema>;

/** Her satıra bir hizmet adı; boş satırlar ve tekrarlar atılır. */
export const serviceList = (text: string) => [...new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 30);
