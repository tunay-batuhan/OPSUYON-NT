import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { OfferSettingsForm } from "@/components/offers/offer-settings-form";
import { hasPermission, requireStaff } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { loadOfferSettings } from "../data";

export const metadata: Metadata = { title: "Teklif ayarları" };

export default async function OfferSettingsPage() {
  const user = await requireStaff();
  if (!hasPermission(user, "offers.manage")) redirect("/teklifler");
  const s = await loadOfferSettings();
  return (
    <Card className="max-w-3xl">
      <CardHeader title="Yeni teklif varsayılanları" description="Her teklifte ayrıca değiştirilebilir. Kayıtlı teklifler bu ayardan etkilenmez." />
      <OfferSettingsForm
        defaults={{
          fee_per_person: formatNumber(s.fee_per_person),
          vat_rate: formatNumber(s.vat_rate),
          validity_days: String(s.validity_days),
          services: s.services.join("\n"),
        }}
      />
    </Card>
  );
}
