/**
 * Kıdem ve ihbar tazminatı tahmini hesabı (4857 sayılı İş Kanunu md. 17, 1475 sayılı İş Kanunu md. 14).
 * Saf hesap modülü: React yok, tarayıcı API'si yok; ana sayfadaki hesaplayıcı (components/site/severance-calculator.tsx)
 * ve testler buradan çağırır. Sonuçlar TAHMİNDİR.
 */

/**
 * Kıdem tazminatı tavanı (aylık brüt, ₺). Her yıl OCAK ve TEMMUZ aylarında memur katsayılarına göre değişir;
 * yeni dönem açıklanınca `amount`, `from` ve `to` güncellenmelidir.
 * 01.01.2026 – 30.06.2026 dönemi için 64.948,77 ₺ kullanıldı. 01.07.2026 sonrası dönemin tavanı bu kod yazılırken
 * doğrulanamadı; güncel değer resmî kaynaktan (Hazine ve Maliye Bakanlığı genelgesi) kontrol edilip girilmelidir.
 */
export const KIDEM_TAVANI = {
  amount: 64_948.77,
  from: "2026-01-01",
  to: "2026-06-30",
} as const;

/** Damga vergisi oranı: binde 7,59 (kıdem ve ihbar tazminatından kesilir). */
export const DAMGA_VERGISI_ORANI = 0.00759;

/**
 * İhbar tazminatından kesilen gelir vergisi için VARSAYILAN oran: %15 (gelir vergisi tarifesinin ilk dilimi).
 * Gerçek oran çalışanın o yılki kümülatif vergi matrahına göre %15–%40 arasında değişir; bu yalnızca tahmindir.
 */
export const IHBAR_GELIR_VERGISI_ORANI = 0.15;

const DAY_MS = 86_400_000;

export type ServicePeriod = { years: number; months: number; days: number; totalDays: number };

export type SeveranceInput = {
  /** İşe giriş tarihi, "YYYY-AA-GG". */
  start: string;
  /** İşten çıkış tarihi (son çalışma günü, hizmete dahil), "YYYY-AA-GG". */
  end: string;
  /** Aylık brüt ücret (₺). */
  grossWage: number;
  /** Düzenli ek ödemeler (yemek, yol vb.; aylık brüt ₺). Giydirilmiş ücrete eklenir. */
  extras?: number;
  /** İhbar tazminatı ödenecek mi (işveren bildirim süresi vermeden feshettiyse). */
  noticeApplies: boolean;
};

export type SeveranceResult = {
  service: ServicePeriod;
  /** Giydirilmiş aylık brüt ücret (brüt + düzenli ek ödemeler). */
  dressedWage: number;
  /** Kıdemde esas alınan aylık ücret (tavanla sınırlı). */
  kidemBaseWage: number;
  /** Giydirilmiş ücret tavanı aştı mı. */
  capped: boolean;
  /** En az 1 tam yıl hizmet var mı. */
  kidemEligible: boolean;
  kidemGross: number;
  kidemStamp: number;
  kidemNet: number;
  noticeApplies: boolean;
  noticeWeeks: number;
  ihbarGross: number;
  ihbarIncomeTax: number;
  ihbarStamp: number;
  ihbarNet: number;
  totalNet: number;
};

export type SeveranceErrors = Partial<Record<"start" | "end" | "grossWage" | "extras", string>>;

/** Kuruşa yuvarlar. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "YYYY-AA-GG" → UTC gece yarısı zaman damgası; geçersizse null. */
export function parseIsoDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t;
}

/**
 * Türkçe yazılmış tutarı sayıya çevirir: "50.000", "50.000,50", "50000,5", "50000.5", "₺ 50 000" kabul edilir.
 * Boş ya da geçersizse NaN.
 */
export function parseMoney(raw: string): number {
  let s = raw.replace(/[₺\s]/g, "").replace(/tl$/i, "");
  if (!s) return NaN;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // "50.000" binlik ayraçlı
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/**
 * Hizmet süresi: giriş günü ve çıkış (son çalışma) günü dahil. Yıl/ay/gün takvime göre ayrıştırılır;
 * ör. 01.01.2020 – 31.12.2020 = 1 yıl 0 ay 0 gün.
 */
export function servicePeriod(start: string, end: string): ServicePeriod | null {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (s === null || e === null || e < s) return null;
  const a = new Date(s);
  const endExcl = e + DAY_MS; // çıkış günü dahil → ertesi gün (hariç) bitiş
  const b = new Date(endExcl);
  let totalMonths = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) totalMonths -= 1;
  // giriş tarihine tam aylar eklenir (ay sonuna sıkıştırılarak: 31 Ocak + 1 ay = 29/28 Şubat); kalan gün sayılır
  const ty = a.getUTCFullYear() + Math.floor((a.getUTCMonth() + totalMonths) / 12);
  const tm = (a.getUTCMonth() + totalMonths) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const anchor = Date.UTC(ty, tm, Math.min(a.getUTCDate(), lastDay));
  const days = Math.round((endExcl - anchor) / DAY_MS);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return { years, months, days, totalDays: Math.round((endExcl - s) / DAY_MS) };
}

/**
 * İhbar süresi (hafta), 4857 md. 17: 6 aydan az 2; 6 aydan 1,5 yıla kadar 4; 1,5 yıldan 3 yıla kadar 6; 3 yıldan fazla
 * 8 hafta. "…kadar" sınırı dahildir (tam 1,5 yıl → 4 hafta, tam 3 yıl → 6 hafta).
 */
export function noticeWeeks(p: ServicePeriod): number {
  const months = p.years * 12 + p.months;
  const upTo = (limit: number) => months < limit || (months === limit && p.days === 0);
  if (months < 6) return 2;
  if (upTo(18)) return 4;
  if (upTo(36)) return 6;
  return 8;
}

/** Girdileri denetler; hata yoksa boş nesne döner. */
export function validateSeverance(input: { start: string; end: string; grossWage: number; extras?: number }): SeveranceErrors {
  const errors: SeveranceErrors = {};
  const s = parseIsoDate(input.start);
  const e = parseIsoDate(input.end);
  if (s === null) errors.start = "Geçerli bir işe giriş tarihi girin.";
  if (e === null) errors.end = "Geçerli bir işten çıkış tarihi girin.";
  else if (s !== null && e < s) errors.end = "İşten çıkış tarihi işe giriş tarihinden önce olamaz.";
  if (!Number.isFinite(input.grossWage) || input.grossWage <= 0) errors.grossWage = "Aylık brüt ücret 0’dan büyük olmalı.";
  if (input.extras !== undefined && (!Number.isFinite(input.extras) || input.extras < 0)) {
    errors.extras = "Ek ödemeler 0 ya da daha büyük bir tutar olmalı.";
  }
  return errors;
}

/** Kıdem ve ihbar tazminatını hesaplar; girdiler geçersizse null. */
export function calculateSeverance(input: SeveranceInput): SeveranceResult | null {
  if (Object.keys(validateSeverance(input)).length > 0) return null;
  const service = servicePeriod(input.start, input.end);
  if (!service) return null;

  const dressedWage = round2(input.grossWage + (input.extras ?? 0));

  // Kıdem: her tam yıl için 30 günlük (bir aylık) giydirilmiş ücret, artan ay ve günler oranında; ücret tavanla sınırlı.
  const kidemBaseWage = Math.min(dressedWage, KIDEM_TAVANI.amount);
  const capped = dressedWage > KIDEM_TAVANI.amount;
  const kidemEligible = service.years >= 1;
  const kidemGross = kidemEligible
    ? round2(kidemBaseWage * service.years + (kidemBaseWage / 12) * service.months + (kidemBaseWage / 365) * service.days)
    : 0;
  const kidemStamp = round2(kidemGross * DAMGA_VERGISI_ORANI);
  const kidemNet = round2(kidemGross - kidemStamp);

  // İhbar: günlük giydirilmiş brüt (aylık/30) × bildirim süresi günü; tavan yok.
  const weeks = noticeWeeks(service);
  const ihbarGross = input.noticeApplies ? round2((dressedWage / 30) * weeks * 7) : 0;
  const ihbarIncomeTax = round2(ihbarGross * IHBAR_GELIR_VERGISI_ORANI);
  const ihbarStamp = round2(ihbarGross * DAMGA_VERGISI_ORANI);
  const ihbarNet = round2(ihbarGross - ihbarIncomeTax - ihbarStamp);

  return {
    service,
    dressedWage,
    kidemBaseWage,
    capped,
    kidemEligible,
    kidemGross,
    kidemStamp,
    kidemNet,
    noticeApplies: input.noticeApplies,
    noticeWeeks: weeks,
    ihbarGross,
    ihbarIncomeTax,
    ihbarStamp,
    ihbarNet,
    totalNet: round2(kidemNet + ihbarNet),
  };
}

const moneyFmt = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 → "₺1.234,50" (tr-TR). */
export const formatTRY = (n: number) => moneyFmt.format(n);

/** Hizmet süresi metni: "5 yıl 3 ay 0 gün". */
export const formatService = (p: ServicePeriod) => `${p.years} yıl ${p.months} ay ${p.days} gün`;
