// Teklif hesabı. Saf fonksiyonlar: tabletteki canlı hesap (tarayıcı), kayıt (sunucu) ve PDF AYNI kodu kullanır.
//
// Müşterinin bugünkü durumu (hizmeti bir firmadan alıyor):
//   kişi başı bedel   = personel maliyeti (ara toplam) + şirket kâr payı        (maliyet tablosu Excel'i, "TEKLİF DETAYI")
//   aylık matrah      = Σ kişi başı bedel × kişi sayısı
//   KDV               = matrah × KDV oranı
// OPSUYON ile kazanç ("fiyat avantajı"):
//   KDV farkı         = KDV − OPSUYON toplam teklif tutarı (toplam kişi × kişi başı OPSUYON bedeli)
//   şirket kâr payı   = Σ kişi başı kâr payı × kişi sayısı
//   aylık net kâr     = KDV farkı + şirket kâr payı × personel sayısı          yıllık = aylık × 12
// Kişi başı kâr payı: satırda maliyet detayı varsa tablodan (ara toplam × %); yoksa bedelin içinden (bedel × % ÷ (100 + %)).

/** Kuruşa yuvarla (0,005 → 0,01; kayan nokta hatasını düzeltir). */
export const r2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

/* ------------------------------------------------------------------ */
/* Maliyet tablosu (kişi başı işveren maliyeti)                         */
/* ------------------------------------------------------------------ */
/** Oranlar ve sabitler: yıl içinde değişebilir, Ayarlar'dan düzenlenir ve teklifle birlikte saklanır. */
export type CostParams = {
  sgk_employer: number;   // SGK işveren payı %
  sgk_employee: number;   // SGK işçi payı %
  unemp_employer: number; // işsizlik fonu işveren %
  unemp_employee: number; // işsizlik fonu işçi %
  income_tax: number;     // gelir vergisi %
  stamp: number;          // damga vergisi %
  min_gross: number;      // asgari ücret brüt (damga istisnası)
  min_net: number;        // asgari ücret net (gelir vergisi istisnası)
  net_ratio: number;      // netten brüte oran (yol / fazla mesai): net ÷ oran = brüt
  ot_divisor: number;     // fazla mesai: aylık saat (225)
  ot_multiplier: number;  // fazla mesai çarpanı (1,5)
  severance: number;      // kıdem tazminatı fonu fiyata dahil mi (0 / 1)
  leave: number;          // yıllık izin fonu (0 / 1)
  holiday: number;        // resmi tatil mesaisi fonu (0 / 1)
  leave_days: number;     // yıllık izin fonu gün (16)
  holiday_days: number;   // resmi tatil gün (15,5)
};

export const DEFAULT_COST_PARAMS: CostParams = {
  sgk_employer: 19.75, sgk_employee: 14, unemp_employer: 2, unemp_employee: 1, income_tax: 15, stamp: 0.759,
  min_gross: 33030, min_net: 28075.5, net_ratio: 0.7149, ot_divisor: 225, ot_multiplier: 1.5,
  severance: 0, leave: 0, holiday: 0, leave_days: 16, holiday_days: 15.5,
};

export const COST_PARAM_LABELS: Record<keyof CostParams, string> = {
  sgk_employer: "SGK işveren payı (%)", sgk_employee: "SGK işçi payı (%)", unemp_employer: "İşsizlik fonu işveren (%)", unemp_employee: "İşsizlik fonu işçi (%)",
  income_tax: "Gelir vergisi (%)", stamp: "Damga vergisi (%)", min_gross: "Asgari ücret brüt (₺)", min_net: "Asgari ücret net (₺)",
  net_ratio: "Netten brüte oran", ot_divisor: "Fazla mesai: aylık saat", ot_multiplier: "Fazla mesai çarpanı",
  severance: "Kıdem tazminatı fonu (0 = dahil değil, 1 = dahil)", leave: "Yıllık izin fonu (0 / 1)", holiday: "Resmi tatil mesaisi fonu (0 / 1)",
  leave_days: "Yıllık izin fonu gün", holiday_days: "Resmi tatil gün",
};

export function normalizeCostParams(raw: unknown): CostParams {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_COST_PARAMS };
  for (const k of Object.keys(out) as (keyof CostParams)[]) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (out.net_ratio <= 0) out.net_ratio = DEFAULT_COST_PARAMS.net_ratio;
  if (out.ot_divisor <= 0) out.ot_divisor = DEFAULT_COST_PARAMS.ot_divisor;
  return out;
}

/** Bir görevlinin (kişi başı) maliyet girdileri. */
export type CostInput = {
  gross: number;          // brüt maaş
  net_transport: number;  // net yol ücreti
  ot_hours: number;       // fazla mesai saati
  clothing: number;       // kıyafet
  equipment: number;      // teçhizat
  ohs: number;            // iş sağlığı ve güvenliği
  training: number;       // eğitim, denetim, kırtasiye
  insurance: number;      // zorunlu mali mesuliyet sigortası
  card: number;           // alışveriş kartı (ticket)
  extra: number;          // ek ödeme (bordroda istisna tutar)
};
export const EMPTY_COST: CostInput = { gross: 0, net_transport: 0, ot_hours: 0, clothing: 0, equipment: 0, ohs: 0, training: 0, insurance: 0, card: 0, extra: 0 };
export const COST_INPUT_LABELS: Record<keyof CostInput, string> = {
  gross: "Brüt maaş", net_transport: "Net yol ücreti", ot_hours: "Fazla mesai saati", clothing: "Kıyafet giderleri", equipment: "Teçhizat giderleri",
  ohs: "İş sağlığı ve güvenliği", training: "Eğitim, denetim, kırtasiye", insurance: "Mali mesuliyet sigortası", card: "Alışveriş kartı (ticket)", extra: "Ek ödeme (istisna tutar)",
};

export type CostRow = { label: string; value: number; kind?: "section" | "subtotal" | "total" | "info" };
export type CostResult = {
  rows: CostRow[];
  /** ARA TOPLAM: şirket kâr payı hariç kişi başı maliyet */
  subtotal: number;
  /** ŞİRKET KÂR PAYI (kişi başı) */
  profit: number;
  /** GENEL TOPLAM: kişi başı bedel (KDV hariç) */
  unit: number;
  /** NET ELE GEÇEN MAAŞ */
  take_home: number;
};

/**
 * Kişi başı maliyet (müşterinin "MALİYET ANALİZ TABLOSU" Excel'iyle aynı satırlar ve formüller). Değerler yuvarlanmadan
 * zincirlenir (Excel gibi); gösterimde 2 ondalığa yuvarlanır.
 */
export function calcCost(input: CostInput, p: CostParams, profitPct: number): CostResult {
  const g = Math.max(0, num(input.gross));
  const pct = (x: number) => x / 100;
  // maaş
  const sgkEr = g * pct(p.sgk_employer), sgkEe = g * pct(p.sgk_employee), unEr = g * pct(p.unemp_employer), unEe = g * pct(p.unemp_employee);
  const taxBase = g - sgkEe - unEe;
  const incomeTax = taxBase <= p.min_net ? 0 : (taxBase - p.min_net) * pct(p.income_tax);
  const stamp = g <= p.min_gross ? 0 : (g - p.min_gross) * pct(p.stamp);
  const netSalary = g - sgkEe - unEe - incomeTax - stamp;
  const salaryCost = g + sgkEr + unEr;
  // yol (netten brüte)
  const tNet = Math.max(0, num(input.net_transport));
  const tGross = tNet / p.net_ratio;
  const tSgkEr = tGross * pct(p.sgk_employer), tSgkEe = tGross * pct(p.sgk_employee), tUnEr = tGross * pct(p.unemp_employer);
  const tTax = (tGross - tSgkEe - tUnEr) * pct(p.income_tax); // Excel'deki formülle aynı (işveren işsizlik payı düşülüyor)
  const tStamp = tGross * pct(p.stamp);
  const transportCost = tGross + tSgkEr + tUnEr + tTax + tStamp;
  // fazla mesai
  const hours = Math.max(0, num(input.ot_hours));
  const oGross = (g / p.ot_divisor) * p.ot_multiplier * hours;
  const oNet = oGross * p.net_ratio;
  const oSgkEr = oGross * pct(p.sgk_employer), oSgkEe = oGross * pct(p.sgk_employee), oUnEr = oGross * pct(p.unemp_employer), oUnEe = oGross * pct(p.unemp_employee);
  const oTax = (oGross - oSgkEe - oUnEe) * pct(p.income_tax);
  const oStamp = oGross * pct(p.stamp);
  const overtimeCost = oGross + oSgkEr + oUnEr + oUnEe + oTax + oStamp;
  // fonlar
  const card = Math.max(0, num(input.card)), extra = Math.max(0, num(input.extra));
  const severance = ((g + tGross + oGross + card) / 12) * p.severance;
  const leave = ((((salaryCost + transportCost + overtimeCost + card) / 30) * p.leave_days) / 12) * p.leave;
  const holiday = ((((salaryCost + tGross) / 30) * p.holiday_days) / 12) * p.holiday;
  const funds = severance + leave + holiday;
  // şirket giderleri
  const company = [input.clothing, input.equipment, input.ohs, input.training, input.insurance].reduce((s, v) => s + Math.max(0, num(v)), 0);

  const subtotal = salaryCost + transportCost + overtimeCost + funds + company + card + extra;
  const profit = subtotal * pct(Math.max(0, num(profitPct)));
  const unit = subtotal + profit;
  const take_home = netSalary + tNet + oNet + card + extra;
  const rate = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(n);
  const rows: CostRow[] = [
    { label: "MAAŞ GİDERLERİ", value: 0, kind: "section" },
    { label: "Brüt maaş", value: g },
    { label: "Net maaş", value: netSalary, kind: "info" },
    { label: `SGK işveren payı (%${rate(p.sgk_employer)})`, value: sgkEr },
    { label: `SGK işçi payı (%${rate(p.sgk_employee)})`, value: sgkEe, kind: "info" },
    { label: `İşsizlik fonu işveren payı (%${rate(p.unemp_employer)})`, value: unEr },
    { label: `İşsizlik fonu işçi payı (%${rate(p.unemp_employee)})`, value: unEe, kind: "info" },
    { label: `Gelir vergisi (%${rate(p.income_tax)})`, value: incomeTax, kind: "info" },
    { label: "Damga vergisi", value: stamp, kind: "info" },
    { label: "Maliyet toplamı (maaş)", value: salaryCost, kind: "subtotal" },
    { label: "YOL GİDERLERİ", value: 0, kind: "section" },
    { label: "Net yol ücreti", value: tNet, kind: "info" },
    { label: "Brüt yol ücreti", value: tGross },
    { label: "SGK ve işsizlik işveren payı", value: tSgkEr + tUnEr },
    { label: "Gelir ve damga vergisi", value: tTax + tStamp },
    { label: "Maliyet toplamı (yol ücreti)", value: transportCost, kind: "subtotal" },
    ...(hours > 0
      ? ([
          { label: "FAZLA MESAİ GİDERLERİ", value: 0, kind: "section" },
          { label: `Fazla mesai brüt ücreti (${rate(hours)} saat)`, value: oGross },
          { label: "Fazla mesai net ücreti", value: oNet, kind: "info" },
          { label: "Maliyet toplamı (fazla mesai)", value: overtimeCost, kind: "subtotal" },
        ] as CostRow[])
      : []),
    ...(funds > 0
      ? ([
          { label: "FONLAR", value: 0, kind: "section" },
          { label: "Kıdem tazminatı fonu", value: severance },
          { label: "Yıllık izin fonu", value: leave },
          { label: "Resmi tatil mesaisi fonu", value: holiday },
          { label: "Maliyet toplamı (fonlar)", value: funds, kind: "subtotal" },
        ] as CostRow[])
      : []),
    { label: "ŞİRKET GİDERLERİ", value: 0, kind: "section" },
    { label: "Kıyafet, teçhizat, İSG, eğitim, sigorta", value: company, kind: "subtotal" },
    { label: "Alışveriş kartı (ticket)", value: card },
    { label: "Ek ödeme (bordroda istisna tutar)", value: extra },
    { label: "ARA TOPLAM", value: subtotal, kind: "total" },
    { label: `Şirket kâr payı (%${rate(profitPct)})`, value: profit, kind: "subtotal" },
    { label: "GENEL TOPLAM (kişi başı bedel)", value: unit, kind: "total" },
    { label: "Net ele geçen maaş", value: take_home, kind: "info" },
  ];
  return { rows, subtotal, profit, unit, take_home };
}

/* ------------------------------------------------------------------ */
/* Teklif                                                              */
/* ------------------------------------------------------------------ */
export type OfferLineInput = {
  service: string;
  people: number;
  /** kişi başı hizmet bedeli (KDV hariç); maliyet detayı varsa oradan hesaplanır */
  unit_price: number;
  /** maliyet tablosu girdileri (Maliyet karşılaştırma ekranı); yoksa null */
  cost?: CostInput | null;
};

export type OfferCalcLine = {
  service: string;
  people: number;
  unit_price: number;
  monthly_total: number;
  /** kişi başı şirket kâr payı */
  profit_unit: number;
  cost: CostResult | null;
};

export type OfferCalc = {
  lines: OfferCalcLine[];
  total_people: number;
  /** aylık matrah (KDV hariç toplam) */
  monthly_base: number;
  monthly_vat: number;
  /** OPSUYON toplam teklif tutarı (aylık) */
  offer_total: number;
  /** KDV farkı = KDV − OPSUYON teklifi */
  vat_saving: number;
  /** şirket kâr payı × personel sayısı (aylık) */
  profit_share_total: number;
  monthly_profit: number;
  yearly_profit: number;
  /** karşılaştırma: müşterinin bugün ödediği ve OPSUYON ile ödeyeceği aylık toplam */
  current_total: number;
  opsuyon_total: number;
};

export function calcOffer(lines: OfferLineInput[], vatRate: number, feePerPerson: number, profitPct = 0, params: CostParams = DEFAULT_COST_PARAMS): OfferCalc {
  const pct = Math.max(0, num(profitPct));
  const rows: OfferCalcLine[] = lines.map((l) => {
    const people = Math.max(0, Math.trunc(num(l.people)));
    const cost = l.cost ? calcCost(l.cost, params, pct) : null;
    const unitRaw = cost ? cost.unit : Math.max(0, num(l.unit_price));
    const profitRaw = cost ? cost.profit : (unitRaw * pct) / (100 + pct);
    return { service: l.service, people, unit_price: r2(unitRaw), monthly_total: r2(unitRaw * people), profit_unit: r2(profitRaw), cost };
  });
  const total_people = rows.reduce((s, l) => s + l.people, 0);
  const monthly_base = r2(rows.reduce((s, l) => s + l.monthly_total, 0));
  const monthly_vat = r2((monthly_base * num(vatRate)) / 100);
  const offer_total = r2(total_people * num(feePerPerson));
  const profit_share_total = r2(rows.reduce((s, l) => s + (l.cost ? l.cost.profit : l.profit_unit) * l.people, 0));
  const vat_saving = r2(monthly_vat - offer_total);
  const monthly_profit = r2(vat_saving + profit_share_total);
  const current_total = r2(monthly_base + monthly_vat);
  return {
    lines: rows, total_people, monthly_base, monthly_vat, offer_total, vat_saving, profit_share_total,
    monthly_profit, yearly_profit: r2(monthly_profit * 12),
    current_total, opsuyon_total: r2(current_total - monthly_profit),
  };
}

export type OfferStatus = "draft" | "sent" | "accepted" | "rejected";

export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: "neutral" | "brand" | "success" | "danger" }> = {
  draft: { label: "Taslak", tone: "neutral" },
  sent: { label: "Gönderildi", tone: "brand" },
  accepted: { label: "Kabul edildi", tone: "success" },
  rejected: { label: "Reddedildi", tone: "danger" },
};

export const isOfferStatus = (v: unknown): v is OfferStatus => typeof v === "string" && Object.hasOwn(OFFER_STATUS, v);

/** "%20" gibi gösterim: 20 → "20", 18,5 → "18,5" */
export const formatRate = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
