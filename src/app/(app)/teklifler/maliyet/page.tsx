import { redirect } from "next/navigation";

/** Maliyet karşılaştırma artık "Yeni teklif"in 2. adımı (isteğe bağlı); eski adres oraya yönlenir. */
export default function CostOfferPage() {
  redirect("/teklifler/yeni");
}
