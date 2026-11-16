import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OfferForm } from "@/components/offers/offer-form";
import { hasPermission, requireStaff } from "@/lib/auth";
import { loadOfferSettings } from "../data";
import { newOfferDefaults } from "../form-defaults";

export const metadata: Metadata = { title: "Yeni teklif" };

export default async function NewOfferPage() {
  const user = await requireStaff();
  if (!hasPermission(user, "offers.manage")) redirect("/teklifler");
  const settings = await loadOfferSettings();
  return <OfferForm defaults={newOfferDefaults(settings)} />;
}
