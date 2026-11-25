import "server-only";
import { formatNumber, isoDayInTurkey } from "@/lib/format";
import { EMPTY_LINE, type OfferValues } from "@/lib/schemas-offers";
import type { OfferDetail, OfferLine, OfferSettings } from "./data";

/** Forma yazılacak sayı: 7500 → "7.500", 58333.33 → "58.333,33" (toMoney geri okur); 0 → "". */
const amount = (n: number | undefined | null) => (n ? formatNumber(n) : "");

/** Yeni teklif: ayarlardaki hizmet satırları boş; kişi başı tutar, KDV, kâr payı, fonlar ve geçerlilik ayarlardan. */
export function newOfferDefaults(s: OfferSettings): OfferValues {
  return {
    id: "",
    compare: false,
    fund_severance: s.cost_params.severance > 0,
    fund_leave: s.cost_params.leave > 0,
    fund_holiday: s.cost_params.holiday > 0,
    customer_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    vat_rate: formatNumber(s.vat_rate),
    fee_per_person: formatNumber(s.fee_per_person),
    profit_pct: formatNumber(s.profit_pct),
    valid_until: isoDayInTurkey(s.validity_days),
    lines: s.services.map((service) => ({ ...EMPTY_LINE, service })),
  };
}

export function editOfferDefaults(o: OfferDetail, lines: OfferLine[]): OfferValues {
  return {
    id: o.id,
    compare: o.with_comparison,
    fund_severance: o.cost_params.severance > 0,
    fund_leave: o.cost_params.leave > 0,
    fund_holiday: o.cost_params.holiday > 0,
    customer_name: o.customer_name,
    contact_name: o.contact_name ?? "",
    phone: o.phone ?? "",
    email: o.email ?? "",
    address: o.address ?? "",
    notes: o.notes ?? "",
    vat_rate: formatNumber(o.vat_rate),
    fee_per_person: formatNumber(o.fee_per_person),
    profit_pct: formatNumber(o.profit_pct),
    valid_until: o.valid_until ?? "",
    lines: lines.length
      ? lines.map((l) => ({
          ...EMPTY_LINE,
          service: l.service,
          people: String(l.people),
          // maliyet tablosundan hesaplanan bedel forma yazılmaz: maliyet kalemleri silinirse eski hesap bedel sanılmasın
          unit_price: l.cost && l.cost.gross > 0 ? "" : amount(Math.round(l.unit_price * 100) / 100),
          ...(l.cost
            ? {
                gross: amount(l.cost.gross), net_transport: amount(l.cost.net_transport), ot_hours: amount(l.cost.ot_hours), clothing: amount(l.cost.clothing),
                equipment: amount(l.cost.equipment), ohs: amount(l.cost.ohs), training: amount(l.cost.training), insurance: amount(l.cost.insurance),
                card: amount(l.cost.card), extra: amount(l.cost.extra),
              }
            : {}),
        }))
      : [{ ...EMPTY_LINE }],
  };
}
