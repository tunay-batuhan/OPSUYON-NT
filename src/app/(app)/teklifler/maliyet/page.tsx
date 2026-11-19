import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OfferForm } from "@/components/offers/offer-form";
import { hasPermission, requireStaff } from "@/lib/auth";
import { loadOfferSettings } from "../data";
import { newOfferDefaults } from "../form-defaults";

export const metadata: Metadata = { title: "Maliyet karşılaştırma" };

export default async function CostOfferPage() {
  const user = await requireStaff();
  if (!hasPermission(user, "offers.manage")) redirect("/teklifler");
  const settings = await loadOfferSettings();
  return <OfferForm defaults={newOfferDefaults(settings, "maliyet")} params={settings.cost_params} />;
}
