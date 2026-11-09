import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PATROL_KEEP_DAYS, isIsoDate } from "@/lib/patrol";
import { loadDailyReport, loadRangeReport } from "@/lib/patrol-report";
import { buildPatrolRangePdf, buildPatrolReportPdf } from "@/lib/pdf/patrol-pdf";

/**
 * Devriye raporu (PDF), okutma kayıtlarından her istekte otomatik üretilir.
 *   ?proje=…&tarih=YYYY-AA-GG           → günlük rapor
 *   ?proje=…&bas=YYYY-AA-GG&bit=YYYY-AA-GG → tarih aralığı raporu (haftalık / aylık; en fazla saklama süresi kadar)
 * Yetki: çağıranın bu projede "patrol.read" izni olmalıdır (staff için genel izin dahil).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const proje = q.get("proje") ?? "";
  const tarih = q.get("tarih");
  let bas = q.get("bas");
  let bit = q.get("bit");
  const daily = isIsoDate(tarih);
  const ranged = !daily && isIsoDate(bas) && isIsoDate(bit);
  if (!/^[0-9a-f-]{36}$/i.test(proje) || (!daily && !ranged)) return new NextResponse("Geçersiz istek", { status: 400 });
  if (ranged && bas! > bit!) [bas, bit] = [bit, bas];
  if (ranged && (Date.parse(bit!) - Date.parse(bas!)) / 86400000 >= PATROL_KEEP_DAYS + 1) return new NextResponse("Aralık çok uzun", { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: perms } = await supabase.rpc("my_project_permissions", { p_project_id: proje });
  if (!((perms as string[] | null) ?? []).includes("patrol.read")) return new NextResponse("Not found", { status: 404 });

  let pdf: Uint8Array;
  let fileName: string;
  if (daily) {
    const report = await loadDailyReport(proje, tarih);
    if (!report) return new NextResponse("Not found", { status: 404 });
    pdf = await buildPatrolReportPdf(report);
    fileName = `devriye-raporu-${tarih}.pdf`;
  } else {
    const report = await loadRangeReport(proje, bas!, bit!);
    if (!report) return new NextResponse("Not found", { status: 404 });
    pdf = await buildPatrolRangePdf(report);
    fileName = `devriye-raporu-${bas}_${bit}.pdf`;
  }
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${q.get("goster") ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
