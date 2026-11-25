import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { OfferForm } from "@/components/offers/offer-form";
import { hasPermission, requireStaff } from "@/lib/auth";
import { loadOffer, loadOfferSettings } from "../../data";
import { editOfferDefaults } from "../../form-defaults";

export const metadata: Metadata = { title: "Teklifi düzenle" };

export default async function EditOfferPage({ params }: PageProps<"/teklifler/[id]/duzenle">) {
  const { id } = await params;
  const user = await requireStaff();
  if (!hasPermission(user, "offers.manage")) redirect(`/teklifler/${id}`);
  const [data, settings] = await Promise.all([loadOffer(id), loadOfferSettings()]);
  if (!data) notFound();
  return (
    <>
      <Link href={`/teklifler/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> {data.offer.offer_no} · {data.offer.customer_name}
      </Link>
      <OfferForm defaults={editOfferDefaults(data.offer, data.lines)} settings={settings.cost_params} />
    </>
  );
}
