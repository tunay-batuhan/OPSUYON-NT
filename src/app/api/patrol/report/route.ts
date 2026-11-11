import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PATROL_KEEP_DAYS, isIsoDate, isTourStatus } from "@/lib/patrol";
import { loadTourReport } from "@/lib/patrol-report";
import { buildPatrolTourPdf } from "@/lib/pdf/patrol-pdf";

/**
 * Devriye raporu (PDF), tur ve okutma kayıtlarından her istekte otomatik üretilir.
 *   ?proje=…&tarih=YYYY-AA-GG              → günlük rapor
 *   ?proje=…&bas=YYYY-AA-GG&bit=YYYY-AA-GG → tarih aralığı raporu (en fazla saklama süresi kadar)
 *   isteğe bağlı: &durum=tamam|eksik|zaman_asimi|yeni_tur|devam &personel=ad → sayfadaki filtrelerle aynı
 *   &goster=1 → tarayıcıda aç (indirmek yerine)
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
  const durum = q.get("durum");
  const personel = (q.get("personel") ?? "").trim().slice(0, 60);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: perms } = await supabase.rpc("my_project_permissions", { p_project_id: proje });
  if (!((perms as string[] | null) ?? []).includes("patrol.read")) return new NextResponse("Not found", { status: 404 });

  const start = daily ? tarih : bas!;
  const end = daily ? tarih : bit!;
  const report = await loadTourReport(proje, start, end, { status: isTourStatus(durum) ? durum : null, person: personel || null });
  if (!report) return new NextResponse("Not found", { status: 404 });
  const pdf = await buildPatrolTourPdf(report);
  const fileName = daily ? `devriye-raporu-${tarih}.pdf` : `devriye-raporu-${bas}_${bit}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${q.get("goster") ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
