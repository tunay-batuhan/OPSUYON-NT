// Teklif modülü: tarayıcıda (react-hook-form) ve sunucuda (action içinde) AYNI şema çalışır.
import { z } from "zod";
import { date, decimal, email, money, opt, phone } from "@/lib/schemas";
import { toMoney, toNumber } from "@/lib/parse";
import { DEFAULT_COST_PARAMS, type CostInput, type CostParams, type OfferLineInput } from "@/lib/offer-calc";

/** numeric(14,2) üst sınırı */
const MAX_AMOUNT = 999_999_999_999;

const people = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,6}$/.test(v), "Kişi sayısı tam sayı olmalı");

/** Maliyet tablosu girdileri (Maliyet karşılaştırma ekranı); Teklif ekranında boş kalır. */
export const COST_FIELDS = ["gross", "net_transport", "ot_hours", "clothing", "equipment", "ohs", "training", "insurance", "card", "extra"] as const;
const costAmount = (label: string) => money(label, { min: 0, max: 99_999_999 });

export const offerLineSchema = z.object({
  service: z.string().trim().min(1, "Hizmet adı zorunlu").max(80, "Hizmet adı en fazla 80 karakter"),
  people,
  /** kişi başı hizmet bedeli (KDV hariç); maliyet ekranında hesaplanır */
  unit_price: money("Kişi başı bedel", { min: 0, max: MAX_AMOUNT }),
  gross: costAmount("Brüt maaş"),
  net_transport: costAmount("Net yol"),
  ot_hours: decimal("Fazla mesai saati", { min: 0, max: 400 }),
  clothing: costAmount("Kıyafet"),
  equipment: costAmount("Teçhizat"),
  ohs: costAmount("İSG"),
  training: costAmount("Eğitim"),
  insurance: costAmount("Sigorta"),
  card: costAmount("Alışveriş kartı"),
  extra: costAmount("Ek ödeme"),
});
export const EMPTY_LINE = { service: "", people: "", unit_price: "", gross: "", net_transport: "", ot_hours: "", clothing: "", equipment: "", ohs: "", training: "", insurance: "", card: "", extra: "" };

export const offerSchema = z
  .object({
    id: z.string().refine((v) => v === "" || /^[0-9a-f-]{36}$/i.test(v), "Geçersiz teklif"),
    customer_name: z.string().trim().min(2, "Müşteri / site adı zorunlu").max(160, "En fazla 160 karakter"),
    contact_name: opt("Yetkili", 120),
    phone,
    email,
    address: opt("Adres", 400),
    notes: opt("Not", 2000),
    /** teklif: kişi başı bedel yazılır · maliyet: maliyet tablosundan hesaplanır */
    kind: z.enum(["teklif", "maliyet"]),
    vat_rate: decimal("KDV oranı", { required: true, min: 0, max: 100 }),
    fee_per_person: money("Kişi başı teklif tutarı", { required: true, min: 0, max: 99_999_999 }),
    profit_pct: decimal("Şirket kâr payı", { required: true, min: 0, max: 100 }),
    valid_until: date("Geçerlilik tarihi"),
    lines: z.array(offerLineSchema).min(1, "En az bir hizmet satırı girin").max(30, "En fazla 30 hizmet satırı"),
  })
  .refine((v) => offerLines(v.lines, v.kind).some((l) => l.people > 0), { path: ["lines"], message: "En az bir hizmette kişi sayısı girin" })
  .refine((v) => v.kind !== "maliyet" || offerLines(v.lines, v.kind).every((l) => l.people === 0 || (l.cost?.gross ?? 0) > 0), { path: ["lines"], message: "Kişi sayısı girilen her görevde brüt maaşı yazın" });

export type OfferValues = z.infer<typeof offerSchema>;

export type OfferLineValues = z.infer<typeof offerLineSchema>;

/** Form satırı → maliyet girdisi. */
export const lineCost = (l: OfferLineValues): CostInput => ({
  gross: toMoney(l.gross) ?? 0, net_transport: toMoney(l.net_transport) ?? 0, ot_hours: toNumber(l.ot_hours) ?? 0,
  clothing: toMoney(l.clothing) ?? 0, equipment: toMoney(l.equipment) ?? 0, ohs: toMoney(l.ohs) ?? 0, training: toMoney(l.training) ?? 0,
  insurance: toMoney(l.insurance) ?? 0, card: toMoney(l.card) ?? 0, extra: toMoney(l.extra) ?? 0,
});

/** Form satırları → hesap girdisi ("" → 0). Maliyet ekranında kişi başı bedel maliyet tablosundan hesaplanır. */
export function offerLines(lines: OfferLineValues[], kind: "teklif" | "maliyet"): OfferLineInput[] {
  return lines.map((l) => ({
    service: l.service.trim(),
    people: Number(l.people || 0),
    unit_price: toMoney(l.unit_price) ?? 0,
    cost: kind === "maliyet" ? lineCost(l) : null,
  }));
}

export const offerNumbers = (v: Pick<OfferValues, "vat_rate" | "fee_per_person" | "profit_pct">) => ({
  vat: toNumber(v.vat_rate) ?? 0,
  fee: toMoney(v.fee_per_person) ?? 0,
  pct: toNumber(v.profit_pct) ?? 0,
});

export const offerSettingsSchema = z.object({
  fee_per_person: money("Kişi başı teklif tutarı", { required: true, min: 0, max: 99_999_999 }),
  vat_rate: decimal("KDV oranı", { required: true, min: 0, max: 100 }),
  validity_days: decimal("Geçerlilik süresi", { required: true, min: 1, max: 365 }).refine((v) => Number.isInteger(toNumber(v)), "Gün sayısı tam sayı olmalı"),
  profit_pct: decimal("Şirket kâr payı", { required: true, min: 0, max: 100 }),
  /** maliyet tablosu oranları (anahtar: CostParams alanı) */
  params: z.record(z.string(), decimal("Oran", { required: true, min: 0, max: 99_999_999 })),
  services: z
    .string()
    .max(2000, "Liste çok uzun")
    .refine((v) => serviceList(v).length > 0, "En az bir hizmet adı yazın")
    .refine((v) => serviceList(v).every((s) => s.length <= 80), "Her hizmet adı en fazla 80 karakter"),
});

export type OfferSettingsValues = z.infer<typeof offerSettingsSchema>;

/** Ayarlar formundaki oranlar → CostParams (eksik / geçersiz olan varsayılanla dolar). */
export function paramsFromForm(form: Record<string, string>): CostParams {
  const out = { ...DEFAULT_COST_PARAMS };
  for (const k of Object.keys(out) as (keyof CostParams)[]) {
    const n = toNumber(form[k] ?? "");
    if (n !== null && n >= 0) out[k] = n;
  }
  return out;
}

/** Antetin üst ve alt boşluğu (mm): teklif içeriği bu boşlukların arasına yazılır. */
export const letterheadMarginsSchema = z.object({
  top_mm: decimal("Üst boşluk", { required: true, min: 0, max: 150 }).refine((v) => Number.isInteger(toNumber(v)), "Tam sayı (mm) yazın"),
  bottom_mm: decimal("Alt boşluk", { required: true, min: 0, max: 100 }).refine((v) => Number.isInteger(toNumber(v)), "Tam sayı (mm) yazın"),
});
export type LetterheadMarginsValues = z.infer<typeof letterheadMarginsSchema>;

/** Antet dosyası: A4 PDF (ilk sayfası kullanılır) ya da PNG/JPG; en fazla 10 MB. */
export const LETTERHEAD_MAX = 10 * 1024 * 1024;
export const LETTERHEAD_ACCEPT = "application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg";
export function letterheadKind(name: string, mime?: string): { ext: "pdf" | "png" | "jpg"; mime: "application/pdf" | "image/png" | "image/jpeg" } | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return { ext: "pdf", mime: "application/pdf" };
  if (m === "image/png" || ext === "png") return { ext: "png", mime: "image/png" };
  if (m === "image/jpeg" || ext === "jpg" || ext === "jpeg") return { ext: "jpg", mime: "image/jpeg" };
  return null;
}

/** Her satıra bir hizmet adı; boş satırlar ve tekrarlar atılır. */
export const serviceList = (text: string) => [...new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 30);
