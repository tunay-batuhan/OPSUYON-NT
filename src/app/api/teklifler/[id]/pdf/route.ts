import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { buildOfferPdf } from "@/lib/pdf/offer-pdf";
import { loadOffer } from "@/app/(app)/teklifler/data";

/**
 * Tek teklif PDF'i. Yetki: offers.read / offers.manage (merkez); teklifi kullanıcının oturumuyla okur, RLS de denetler.
 *   ?goster=1 → tarayıcıda aç (indirmek yerine)
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/teklifler/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user || (!hasPermission(user, "offers.read") && !hasPermission(user, "offers.manage"))) return new NextResponse("Not found", { status: 404 });
  const { id } = await ctx.params;
  const data = await loadOffer(id);
  if (!data) return new NextResponse("Not found", { status: 404 });
  const { offer: o, lines, creator } = data;

  const pdf = await buildOfferPdf({
    offer_no: o.offer_no,
    customer_name: o.customer_name,
    contact_name: o.contact_name,
    phone: o.phone,
    email: o.email,
    address: o.address,
    notes: o.notes,
    vat_rate: o.vat_rate,
    fee_per_person: o.fee_per_person,
    profit_pct: o.profit_pct,
    cost_params: o.cost_params,
    compare: o.with_comparison,
    valid_until: o.valid_until,
    created_at: o.created_at,
    creator,
    lines,
  });
  const fileName = `teklif-${o.offer_no}-${slugify(o.customer_name).slice(0, 40) || "musteri"}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
