import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { buildOfferPdf, sampleOfferPdfData } from "@/lib/pdf/offer-pdf";
import { loadOfferLetterhead } from "@/app/(app)/teklifler/data";

/**
 * Örnek teklif PDF'i (Teklifler › Ayarlar › Antetli kağıt): antetin ve üst/alt boşlukların nasıl durduğunu görmek için.
 * Yetki: offers.manage. ?goster=1 → tarayıcıda aç.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.kind !== "staff" || !hasPermission(user, "offers.manage")) return new NextResponse("Not found", { status: 404 });
  const pdf = await buildOfferPdf(sampleOfferPdfData(user.full_name || null), await loadOfferLetterhead());
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="ornek-teklif.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
