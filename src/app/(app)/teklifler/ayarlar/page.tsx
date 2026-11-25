import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { OfferSettingsForm } from "@/components/offers/offer-settings-form";
import { hasPermission, requireStaff } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { COST_PARAM_FLAGS } from "@/lib/offer-calc";
import { loadOfferSettings } from "../data";

export const metadata: Metadata = { title: "Teklif ayarları" };

export default async function OfferSettingsPage() {
  const user = await requireStaff();
  if (!hasPermission(user, "offers.manage")) redirect("/teklifler");
  const s = await loadOfferSettings();
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Yeni teklif varsayılanları ve maliyet oranları" description="Her teklifte ayrıca değiştirilebilir. Kayıtlı teklifler bu ayardan etkilenmez." />
        <OfferSettingsForm
          defaults={{
            fee_per_person: formatNumber(s.fee_per_person),
            vat_rate: formatNumber(s.vat_rate),
            validity_days: String(s.validity_days),
            services: s.services.join("\n"),
            profit_pct: formatNumber(s.profit_pct),
            params: Object.fromEntries(
              Object.entries(s.cost_params)
                .filter(([k]) => !(COST_PARAM_FLAGS as readonly string[]).includes(k))
                .map(([k, v]) => [k, new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 4, useGrouping: false }).format(v)]),
            ),
            fund_severance: s.cost_params.severance > 0,
            fund_leave: s.cost_params.leave > 0,
            fund_holiday: s.cost_params.holiday > 0,
          }}
        />
      </Card>
    </div>
  );
}
