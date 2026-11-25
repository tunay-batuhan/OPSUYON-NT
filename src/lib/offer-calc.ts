// Teklif hesabı. Saf fonksiyonlar: tabletteki canlı hesap (tarayıcı), kayıt (sunucu) ve PDF AYNI kodu kullanır.
//
// Müşterinin bugünkü durumu (hizmeti bir firmadan alıyor):
//   kişi başı bedel   = personel maliyeti (ara toplam) + şirket kâr payı        (maliyet tablosu Excel'i, "TEKLİF DETAYI")
//   aylık matrah      = Σ kişi başı bedel × kişi sayısı
//   KDV               = matrah × KDV oranı
// OPSUYON ile kazanç ("fiyat avantajı"):
//   OPSUYON bedeli    = toplam kişi × kişi başı OPSUYON bedeli + bu bedelin KDV'si (%20, Ayarlar'dan)
//   KDV farkı         = KDV − OPSUYON bedeli (KDV dahil)
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
  severance_pct: number;  // kıdem tazminatı fonunun fiyata yansıyan oranı % (100 = tamamı, 70 = %70'i)
  leave: number;          // yıllık izin fonu (0 / 1)
  holiday: number;        // resmi tatil mesaisi fonu (0 / 1)
  leave_days: number;     // yıllık izin fonu gün (16)
  holiday_days: number;   // resmi tatil gün (15,5)
  fee_vat: number;        // OPSUYON hizmet bedelinin KDV oranı %
};

export const DEFAULT_COST_PARAMS: CostParams = {
  sgk_employer: 19.75, sgk_employee: 14, unemp_employer: 2, unemp_employee: 1, income_tax: 15, stamp: 0.759,
  min_gross: 33030, min_net: 28075.5, net_ratio: 0.7149, ot_divisor: 225, ot_multiplier: 1.5,
  severance: 0, severance_pct: 100, leave: 0, holiday: 0, leave_days: 16, holiday_days: 15.5, fee_vat: 20,
};

/** Bu alanlar eklenmeden (OPSUYON bedeli KDV'si) önce kaydedilmiş tekliflerde eksik alanların değeri. */
export const LEGACY_OFFER_PARAMS: Partial<CostParams> = { fee_vat: 0 };

/** Açık / kapalı (0 / 1) oranlar: Ayarlar'da kutucuk olarak gösterilir. */
export const COST_PARAM_FLAGS = ["severance", "leave", "holiday"] as const;

/** "Maliyet tablosu oranları" (SGK, vergi, asgari ücret, mesai, fon günleri): fonların açık/kapalı'sı, kıdem fon oranı ve OPSUYON KDV'si hariç. */
export const COST_RATE_KEYS = (Object.keys(DEFAULT_COST_PARAMS) as (keyof CostParams)[]).filter(
  (k) => !(COST_PARAM_FLAGS as readonly string[]).includes(k) && k !== "severance_pct" && k !== "fee_vat",
);

export const COST_PARAM_LABELS: Record<keyof CostParams, string> = {
  sgk_employer: "SGK işveren payı (%)", sgk_employee: "SGK işçi payı (%)", unemp_employer: "İşsizlik fonu işveren (%)", unemp_employee: "İşsizlik fonu işçi (%)",
  income_tax: "Gelir vergisi (%)", stamp: "Damga vergisi (%)", min_gross: "Asgari ücret brüt (₺)", min_net: "Asgari ücret net (₺)",
  net_ratio: "Netten brüte oran", ot_divisor: "Fazla mesai: aylık saat", ot_multiplier: "Fazla mesai çarpanı",
  severance: "Kıdem tazminatı fonu fiyata dahil", severance_pct: "Kıdem tazminatı fon oranı (%)", leave: "Yıllık izin fonu fiyata dahil",
  holiday: "Resmi tatil mesaisi fonu fiyata dahil", leave_days: "Yıllık izin fonu gün", holiday_days: "Resmi tatil gün", fee_vat: "OPSUYON bedeli KDV oranı (%)",
};

/**
 * Saklanan oranları tamamlar. `legacy`: kayıtta hiç olmayan alanların değeri (ör. bu alanlar eklenmeden önce kaydedilmiş
 * tekliflerde OPSUYON bedeli KDV'siz hesaplanmıştı → { fee_vat: 0 }; tutarları değişmez).
 */
export function normalizeCostParams(raw: unknown, legacy: Partial<CostParams> = {}): CostParams {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_COST_PARAMS, ...legacy };
  for (const k of Object.keys(out) as (keyof CostParams)[]) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (out.net_ratio <= 0) out.net_ratio = DEFAULT_COST_PARAMS.net_ratio;
  if (out.ot_divisor <= 0) out.ot_divisor = DEFAULT_COST_PARAMS.ot_divisor;
  out.severance_pct = Math.min(100, out.severance_pct);
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

/** kind: section → başlık satırı; info → çalışandan kesilen / bilgi satırı (maliyete eklenmez); count → adet (₺ değil). */
export type CostRow = { label: string; value: number; kind?: "section" | "subtotal" | "total" | "info" | "count" };
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
  const severance = ((g + tGross + oGross + card) / 12) * p.severance * (p.severance_pct / 100);
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
  // Satırlar Excel'deki "MALİYET ANALİZ TABLOSU" ile aynı sırada ve EKSİKSİZ (tutarı 0 olanlar dahil): PDF dökümü bunu basar.
  const sgkEr_ = `SGK işveren payı (%${rate(p.sgk_employer)})`, sgkEe_ = `SGK işçi payı (%${rate(p.sgk_employee)})`;
  const unEr_ = `İşsizlik fonu işveren payı (%${rate(p.unemp_employer)})`, unEe_ = `İşsizlik fonu işçi payı (%${rate(p.unemp_employee)})`;
  const tax_ = `Gelir vergisi (%${rate(p.income_tax)})`;
  const rows: CostRow[] = [
    { label: "MAAŞ GİDERLERİ", value: 0, kind: "section" },
    { label: "Brüt maaş", value: g },
    { label: "Net maaş", value: netSalary, kind: "info" },
    { label: sgkEr_, value: sgkEr },
    { label: sgkEe_, value: sgkEe, kind: "info" },
    { label: unEr_, value: unEr },
    { label: unEe_, value: unEe, kind: "info" },
    { label: tax_, value: incomeTax, kind: "info" },
    { label: "Damga vergisi", value: stamp, kind: "info" },
    { label: "Maliyet toplamı (maaş)", value: salaryCost, kind: "subtotal" },
    { label: "YOL GİDERLERİ", value: 0, kind: "section" },
    { label: "Brüt yol ücreti", value: tGross },
    { label: "Net yol ücreti", value: tNet, kind: "info" },
    { label: sgkEr_, value: tSgkEr },
    { label: sgkEe_, value: tSgkEe, kind: "info" },
    { label: unEr_, value: tUnEr },
    { label: unEe_, value: tGross * pct(p.unemp_employee), kind: "info" },
    { label: tax_, value: tTax },
    { label: "Damga vergisi", value: tStamp },
    { label: "Maliyet toplamı (yol ücreti)", value: transportCost, kind: "subtotal" },
    { label: "FAZLA MESAİ GİDERLERİ", value: 0, kind: "section" },
    { label: "Fazla mesai saati", value: hours, kind: "count" },
    { label: "Fazla mesai brüt ücreti", value: oGross },
    { label: "Fazla mesai net ücreti", value: oNet, kind: "info" },
    { label: sgkEr_, value: oSgkEr },
    { label: sgkEe_, value: oSgkEe, kind: "info" },
    { label: unEr_, value: oUnEr },
    { label: unEe_, value: oUnEe },
    { label: tax_, value: oTax },
    { label: "Damga vergisi", value: oStamp },
    { label: "Maliyet toplamı (fazla mesai)", value: overtimeCost, kind: "subtotal" },
    { label: "KIDEM, YILLIK İZİN, RESMİ TATİL FONLARI", value: 0, kind: "section" },
    { label: `Kıdem tazminatı fonu (${p.severance ? (p.severance_pct < 100 ? `%${rate(p.severance_pct)} dahil` : "dahil") : "dahil değil"})`, value: severance },
    { label: `Yıllık izin fonu (${p.leave ? "dahil" : "dahil değil"})`, value: leave },
    { label: `Resmi tatil mesaisi fonu (${p.holiday ? "dahil" : "dahil değil"})`, value: holiday },
    { label: "Maliyet toplamı (kıdem + yıllık izin + resmi tatil)", value: funds, kind: "subtotal" },
    { label: "ŞİRKET GİDERLERİ", value: 0, kind: "section" },
    { label: "Kıyafet giderleri", value: Math.max(0, num(input.clothing)) },
    { label: "Teçhizat giderleri", value: Math.max(0, num(input.equipment)) },
    { label: "İş sağlığı ve güvenliği giderleri", value: Math.max(0, num(input.ohs)) },
    { label: "Eğitim, denetim, kırtasiye giderleri", value: Math.max(0, num(input.training)) },
    { label: "Zorunlu mali mesuliyet sigortası bedeli", value: Math.max(0, num(input.insurance)) },
    { label: "Maliyet toplamı (şirket giderleri)", value: company, kind: "subtotal" },
    { label: "TOPLAM", value: 0, kind: "section" },
    { label: "Alışveriş kartı ücreti (ticket kart ile ödenir)", value: card },
    { label: "Ek ödeme (bordroda istisna tutar)", value: extra },
    { label: "ARA TOPLAM", value: subtotal, kind: "total" },
    { label: `Şirket kâr payı (%${rate(profitPct)})`, value: profit, kind: "subtotal" },
    { label: "GENEL TOPLAM (kişi başı bedel)", value: unit, kind: "total" },
    { label: "Net ele geçen maaş", value: take_home, kind: "subtotal" },
  ];
  return { rows, subtotal, profit, unit, take_home };
}

/**
 * Maliyet tablosunun altındaki "ŞARTLAR VE KOŞULLAR" (Excel'in ANA SAYFA'sındaki koşullu notlar): fonların fiyata
 * dahil olup olmadığına ve SGK işveren payı indirimine göre.
 */
export function costTerms(p: CostParams): string[] {
  const fund = (on: number, name: string) =>
    on
      ? `${name} fiyata dahil edilmiştir. Ek olarak fatura edilmeyecektir.`
      : `${name} fiyata dahil değildir. Oluştuğunda veya mahkeme kararı gereği ödenmesi kararlaştırıldığında tamamı ek olarak fatura edilecektir.`;
  return [
    ...(p.sgk_employer === 15.5 ? ["SGK işveren payı %5 indirim uygulanarak %15,5 üzerinden hesaplanmıştır."] : []),
    p.severance && p.severance_pct < 100
      ? `Kıdem tazminatı fonu %${formatRate(p.severance_pct)} oranında fiyata dahil edilmiştir.`
      : fund(p.severance, "Kıdem tazminatı fonu"),
    fund(p.holiday, "Resmi tatil mesaisi fonu"),
    fund(p.leave, "Yıllık izin fonu"),
  ];
}

/* ------------------------------------------------------------------ */
/* Teklif                                                              */
/* ------------------------------------------------------------------ */
export type OfferLineInput = {
  service: string;
  people: number;
  /** kişi başı hizmet bedeli (KDV hariç); maliyet detayı varsa oradan hesaplanır */
  unit_price: number;
  /** maliyet kalemleri (2. adım: maliyet karşılaştırma); girilmediyse null → kişi başı bedel yazılan tutardır */
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
  /** OPSUYON hizmet bedeli, KDV hariç (toplam kişi × kişi başı tutar) */
  offer_net: number;
  /** OPSUYON hizmet bedelinin KDV'si */
  offer_vat: number;
  /** OPSUYON bedelinin KDV oranı % */
  fee_vat: number;
  /** OPSUYON toplam teklif tutarı (aylık, KDV dahil) */
  offer_total: number;
  /** KDV farkı = KDV − OPSUYON teklifi (KDV dahil) */
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
  const fee_vat = Math.max(0, num(params.fee_vat));
  const offer_net = r2(total_people * num(feePerPerson));
  const offer_vat = r2((offer_net * fee_vat) / 100);
  const offer_total = r2(offer_net + offer_vat);
  const profit_share_total = r2(rows.reduce((s, l) => s + (l.cost ? l.cost.profit : l.profit_unit) * l.people, 0));
  const vat_saving = r2(monthly_vat - offer_total);
  const monthly_profit = r2(vat_saving + profit_share_total);
  const current_total = r2(monthly_base + monthly_vat);
  return {
    lines: rows, total_people, monthly_base, monthly_vat, offer_net, offer_vat, fee_vat, offer_total, vat_saving, profit_share_total,
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
