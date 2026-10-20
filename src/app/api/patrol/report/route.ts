import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/patrol";
import { loadDailyReport } from "@/lib/patrol-report";
import { buildPatrolReportPdf } from "@/lib/pdf/patrol-pdf";

/**
 * Günlük devriye raporu (PDF). Rapor, okutma kayıtlarından her istekte otomatik üretilir.
 * Yetki: çağıranın bu projede "patrol.read" izni olmalıdır (staff için genel izin dahil).
 */
export async function GET(req: NextRequest) {
  const proje = req.nextUrl.searchParams.get("proje") ?? "";
  const tarih = req.nextUrl.searchParams.get("tarih") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(proje) || !isIsoDate(tarih)) return new NextResponse("Geçersiz istek", { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: perms } = await supabase.rpc("my_project_permissions", { p_project_id: proje });
  if (!((perms as string[] | null) ?? []).includes("patrol.read")) return new NextResponse("Not found", { status: 404 });

  const report = await loadDailyReport(proje, tarih);
  if (!report) return new NextResponse("Not found", { status: 404 });

  const pdf = await buildPatrolReportPdf(report);
  const fileName = `devriye-raporu-${tarih}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
