import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { OFFER_STATUS } from "@/lib/offer-calc";
import { buildOfferReportPdf } from "@/lib/pdf/offer-pdf";
import { loadCreatorNames, loadOfferSummary, loadOffers, offerFiltersFrom } from "@/app/(app)/teklifler/data";

/**
 * Teklif raporu PDF'i, Teklifler ekranındaki süzgeçlerle (?bas=&bit=&durum=&hazirlayan=&musteri=) her istekte üretilir.
 * Sayfalama yok: süzgeçlere uyan tüm teklifler (en fazla 2000). ?goster=1 → tarayıcıda aç.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (!hasPermission(user, "offers.read") && !hasPermission(user, "offers.manage"))) return new NextResponse("Not found", { status: 404 });
  const q = req.nextUrl.searchParams;
  const f = offerFiltersFrom(q);

  const [{ rows }, summary] = await Promise.all([loadOffers(f), loadOfferSummary(f)]);
  const names = await loadCreatorNames([...rows.map((r) => r.created_by), f.by ?? null]);

  const filters: [string, string][] = [];
  if (f.start || f.end) filters.push(["Tarih", `${f.start ? formatDate(f.start) : "…"} – ${f.end ? formatDate(f.end) : "…"}`]);
  if (f.status) filters.push(["Durum", OFFER_STATUS[f.status].label]);
  if (f.by) filters.push(["Hazırlayan", names.get(f.by) ?? "—"]);
  if (f.q) filters.push(["Müşteri", f.q]);

  const pdf = await buildOfferReportPdf(
    rows.map((r) => ({ ...r, creator: (r.created_by && names.get(r.created_by)) || null })),
    summary,
    filters,
  );
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${q.get("goster") ? "inline" : "attachment"}; filename="teklif-raporu-${stamp}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
