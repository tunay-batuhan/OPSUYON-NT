// Teklif modülü: tarayıcıda (react-hook-form) ve sunucuda (action içinde) AYNI şema çalışır.
import { z } from "zod";
import { date, decimal, email, money, opt, phone } from "@/lib/schemas";
import { toMoney, toNumber } from "@/lib/parse";
import { COST_PARAM_FLAGS, DEFAULT_COST_PARAMS, normalizeCostParams, type CostInput, type CostParams, type OfferLineInput } from "@/lib/offer-calc";

/** Yüzde oranları (kıdem fon oranı, OPSUYON KDV) %100'ü geçemez. */
function percentLimits(params: Record<string, string>, ctx: z.RefinementCtx) {
  for (const k of ["severance_pct", "fee_vat"]) {
    if ((toNumber(params[k] ?? "") ?? 0) > 100) ctx.addIssue({ code: "custom", path: ["params", k], message: "En fazla %100 olabilir" });
  }
}

/** numeric(14,2) üst sınırı */
const MAX_AMOUNT = 999_999_999_999;

const people = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,6}$/.test(v), "Kişi sayısı tam sayı olmalı");

/** Maliyet kalemleri (2. adım: maliyet karşılaştırma); yalnızca teklif verilecekse boş kalır. */
export const COST_FIELDS = ["gross", "net_transport", "ot_hours", "clothing", "equipment", "ohs", "training", "insurance", "card", "extra"] as const;
const costAmount = (label: string) => money(label, { min: 0, max: 99_999_999 });

export const offerLineSchema = z.object({
  service: z.string().trim().min(1, "Hizmet adı zorunlu").max(80, "Hizmet adı en fazla 80 karakter"),
  people,
  /** kişi başı hizmet bedeli (KDV hariç); 2. adımda brüt maaş yazılan hizmette maliyet tablosundan hesaplanır */
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
    /** 2. adım (maliyet karşılaştırma) teklife eklensin mi; kapalıysa yalnızca teklif (hizmetler ve bedeller) */
    compare: z.boolean(),
    /** fiyata dahil fonlar (maliyet tablosu; Excel'de satırın yanındaki oran) */
    fund_severance: z.boolean(),
    fund_leave: z.boolean(),
    fund_holiday: z.boolean(),
    vat_rate: decimal("KDV oranı", { required: true, min: 0, max: 100 }),
    fee_per_person: money("Kişi başı teklif tutarı", { required: true, min: 0, max: 99_999_999 }),
    profit_pct: decimal("Şirket kâr payı", { required: true, min: 0, max: 100 }),
    valid_until: date("Geçerlilik tarihi"),
    lines: z.array(offerLineSchema).min(1, "En az bir hizmet satırı girin").max(30, "En fazla 30 hizmet satırı"),
    /** bu teklife özel maliyet oranları (varsayılanı Ayarlar'dan; "Oranlar" penceresinde değiştirilir) */
    params: z.record(z.string(), decimal("Oran", { required: true, min: 0, max: 99_999_999 })),
  })
  .superRefine((v, ctx) => percentLimits(v.params, ctx))
  .refine((v) => offerLines(v.lines, v.compare).some((l) => l.people > 0), { path: ["lines"], message: "En az bir hizmette kişi sayısı girin" })
  .refine((v) => offerLines(v.lines, v.compare).every((l) => l.people === 0 || l.cost || l.unit_price > 0), {
    path: ["lines"],
    message: "Kişi sayısı girilen her hizmette kişi başı bedeli yazın (ya da 2. adımda o hizmetin brüt maaşını girin)",
  });

export type OfferValues = z.infer<typeof offerSchema>;

export type OfferLineValues = z.infer<typeof offerLineSchema>;

/** Form satırı → maliyet girdisi. */
export const lineCost = (l: OfferLineValues): CostInput => ({
  gross: toMoney(l.gross) ?? 0, net_transport: toMoney(l.net_transport) ?? 0, ot_hours: toNumber(l.ot_hours) ?? 0,
  clothing: toMoney(l.clothing) ?? 0, equipment: toMoney(l.equipment) ?? 0, ohs: toMoney(l.ohs) ?? 0, training: toMoney(l.training) ?? 0,
  insurance: toMoney(l.insurance) ?? 0, card: toMoney(l.card) ?? 0, extra: toMoney(l.extra) ?? 0,
});

/** Satırda maliyet kalemi girilmiş mi (brüt maaş yazılmış): o satırın kişi başı bedeli maliyet tablosundan hesaplanır. */
export const hasCost = (l: OfferLineValues) => (toMoney(l.gross) ?? 0) > 0;

/**
 * Form satırları → hesap girdisi ("" → 0). Maliyet karşılaştırma açıksa ve satırda brüt maaş yazılmışsa kişi başı
 * bedel maliyet tablosundan hesaplanır; değilse 1. adımda yazılan bedel kullanılır.
 */
export function offerLines(lines: OfferLineValues[], compare: boolean): OfferLineInput[] {
  return lines.map((l) => ({
    service: l.service.trim(),
    people: Number(l.people || 0),
    unit_price: toMoney(l.unit_price) ?? 0,
    cost: compare && hasCost(l) ? lineCost(l) : null,
  }));
}

/** Teklifin maliyet oranları: saklanan / ayarlardaki oranlar + formdaki "fiyata dahil fonlar" işaretleri. */
export const withFunds = (p: CostParams, v: Pick<OfferValues, "fund_severance" | "fund_leave" | "fund_holiday">): CostParams => ({
  ...p,
  severance: v.fund_severance ? 1 : 0,
  leave: v.fund_leave ? 1 : 0,
  holiday: v.fund_holiday ? 1 : 0,
});

/** 1. adımın alanları: hata bunlardaysa form o adıma döner. */
export const STEP1_FIELDS = ["customer_name", "contact_name", "phone", "email", "address", "valid_until", "notes"] as const;

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
  /** maliyet tablosu oranları (anahtar: CostParams alanı; açık/kapalı fonlar hariç) */
  params: z.record(z.string(), decimal("Oran", { required: true, min: 0, max: 99_999_999 })),
  /** fiyata dahil fonlar (kutucuk) */
  fund_severance: z.boolean(),
  fund_leave: z.boolean(),
  fund_holiday: z.boolean(),
  services: z
    .string()
    .max(2000, "Liste çok uzun")
    .refine((v) => serviceList(v).length > 0, "En az bir hizmet adı yazın")
    .refine((v) => serviceList(v).every((s) => s.length <= 80), "Her hizmet adı en fazla 80 karakter"),
}).superRefine((v, ctx) => percentLimits(v.params, ctx));

export type OfferSettingsValues = z.infer<typeof offerSettingsSchema>;

/** Yüzde oranları 100'ü geçemez (kıdem fon oranı, OPSUYON KDV). */
export const PERCENT_PARAMS = ["severance_pct", "fee_vat"] as const;

/** Ayarlar formundaki oranlar ve fon kutucukları → CostParams (eksik / geçersiz olan varsayılanla dolar). */
export function paramsFromForm(form: Record<string, string>, funds: Pick<OfferSettingsValues, "fund_severance" | "fund_leave" | "fund_holiday">): CostParams {
  const out = { ...DEFAULT_COST_PARAMS };
  for (const k of Object.keys(out) as (keyof CostParams)[]) {
    const n = toNumber(form[k] ?? "");
    if (n !== null && n >= 0) out[k] = (PERCENT_PARAMS as readonly string[]).includes(k) ? Math.min(100, n) : n;
  }
  return withFunds(out, funds);
}

/** Oranlar → form alanları ("19,75" gibi; açık/kapalı fonlar hariç: onlar ayrı kutucuk). */
export function paramsToForm(p: CostParams): Record<string, string> {
  const fmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 4, useGrouping: false });
  return Object.fromEntries(
    (Object.keys(p) as (keyof CostParams)[]).filter((k) => !(COST_PARAM_FLAGS as readonly string[]).includes(k)).map((k) => [k, fmt.format(p[k])]),
  );
}

/** Teklif formundaki oranlar + fon kutucukları → hesapta kullanılan oranlar (ekranda canlı hesap ve kayıtta aynı). */
export const offerParams = (v: Pick<OfferValues, "params" | "fund_severance" | "fund_leave" | "fund_holiday">): CostParams =>
  normalizeCostParams(paramsFromForm(v.params ?? {}, v));

/** Her satıra bir hizmet adı; boş satırlar ve tekrarlar atılır. */
export const serviceList = (text: string) => [...new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 30);
