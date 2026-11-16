// Teklif hesabı ("OPSÜYON ile kâra geçin"). Saf fonksiyon: tabletteki canlı hesap (tarayıcı) ve kayıt (sunucu)
// AYNI fonksiyonu kullanır; saklanan tutarlar ekranda görülenle birebir aynıdır.
//
//   aylık matrah     = hizmet tutarlarının toplamı (KDV hariç)
//   KDV              = matrah × KDV oranı ÷ 100
//   OPSÜYON teklifi  = toplam kişi × kişi başı teklif tutarı
//   aylık net kâr    = KDV − OPSÜYON teklifi      (eksi çıkabilir: teklif KDV'den pahalıysa)
//   yıllık net kâr   = aylık net kâr × 12

export type OfferLineInput = { service: string; people: number; monthly_total: number };

export type OfferCalc = {
  lines: (OfferLineInput & { /** kişi başı hizmet bedeli; kişi 0 ise null */ unit_price: number | null })[];
  total_people: number;
  monthly_base: number;
  monthly_vat: number;
  offer_total: number;
  monthly_profit: number;
  yearly_profit: number;
};

/** Kuruşa yuvarla (0,005 → 0,01; kayan nokta hatasını düzeltir). */
export const r2 = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;

const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

export function calcOffer(lines: OfferLineInput[], vatRate: number, feePerPerson: number): OfferCalc {
  const rows = lines.map((l) => {
    const people = Math.max(0, Math.trunc(num(l.people)));
    const total = Math.max(0, r2(num(l.monthly_total)));
    return { service: l.service, people, monthly_total: total, unit_price: people > 0 ? r2(total / people) : null };
  });
  const total_people = rows.reduce((s, l) => s + l.people, 0);
  const monthly_base = r2(rows.reduce((s, l) => s + l.monthly_total, 0));
  const monthly_vat = r2((monthly_base * num(vatRate)) / 100);
  const offer_total = r2(total_people * num(feePerPerson));
  const monthly_profit = r2(monthly_vat - offer_total);
  return { lines: rows, total_people, monthly_base, monthly_vat, offer_total, monthly_profit, yearly_profit: r2(monthly_profit * 12) };
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
