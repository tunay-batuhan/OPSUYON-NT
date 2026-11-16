import "server-only";
import { formatNumber, isoDayInTurkey } from "@/lib/format";
import type { OfferValues } from "@/lib/schemas-offers";
import type { OfferDetail, OfferLine, OfferSettings } from "./data";

/** Forma yazılacak sayı: 7500 → "7.500", 58333.33 → "58.333,33" (toMoney geri okur). */
const amount = (n: number) => formatNumber(n);

/** Yeni teklif: ayarlardaki hizmet satırları boş, kişi başı tutar / KDV / geçerlilik ayarlardan. */
export function newOfferDefaults(s: OfferSettings): OfferValues {
  return {
    id: "",
    customer_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    vat_rate: amount(s.vat_rate),
    fee_per_person: amount(s.fee_per_person),
    valid_until: isoDayInTurkey(s.validity_days),
    lines: s.services.map((service) => ({ service, people: "", monthly_total: "" })),
  };
}

export function editOfferDefaults(o: OfferDetail, lines: OfferLine[]): OfferValues {
  return {
    id: o.id,
    customer_name: o.customer_name,
    contact_name: o.contact_name ?? "",
    phone: o.phone ?? "",
    email: o.email ?? "",
    address: o.address ?? "",
    notes: o.notes ?? "",
    vat_rate: amount(o.vat_rate),
    fee_per_person: amount(o.fee_per_person),
    valid_until: o.valid_until ?? "",
    lines: lines.length
      ? lines.map((l) => ({ service: l.service, people: String(l.people), monthly_total: amount(l.monthly_total) }))
      : [{ service: "", people: "", monthly_total: "" }],
  };
}
