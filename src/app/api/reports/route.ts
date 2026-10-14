import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { canAnywhere, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REPORT_DEFS, buildReport, type ReportType } from "@/lib/reports";
import { slugify } from "@/lib/format";

export const maxDuration = 60;

/** Excel export of a report. Data is read with the caller's session, so RLS limits it to what they may see. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Yetkisiz", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") as ReportType;
  const def = REPORT_DEFS[type];
  if (!def) return new NextResponse("Geçersiz rapor", { status: 400 });
  if (!canAnywhere(user, "reports.read") || !canAnywhere(user, def.permission)) return new NextResponse("Bu rapor için yetkiniz yok", { status: 403 });

  const now = new Date();
  const report = await buildReport(
    type,
    {
      projectId: sp.get("proje") ?? undefined,
      year: Number(sp.get("yil") ?? now.getFullYear()),
      month: Number(sp.get("ay") ?? now.getMonth() + 1),
      days: Number(sp.get("gun") ?? 60),
    },
    await createClient(),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "OPSÜYON";
  const ws = wb.addWorksheet(report.title.slice(0, 28));
  ws.addRow([report.title]).font = { bold: true, size: 14 };
  ws.addRow([report.subtitle]).font = { color: { argb: "FF5A6B86" } };
  ws.addRow([]);
  const head = ws.addRow(report.columns.map((c) => c.label));
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2A63" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  for (const r of report.rows) {
    const row = ws.addRow(r.map((v, i) => (report.columns[i].type === "date" && v ? new Date(String(v)) : v)));
    report.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.type === "money") cell.numFmt = '#,##0.00 "₺"';
      if (c.type === "date") cell.numFmt = "dd.mm.yyyy";
      if (c.type === "number") cell.numFmt = "0.##";
    });
  }
  report.columns.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(14, c.label.length + 6); });
  ws.views = [{ state: "frozen", ySplit: 4 }];

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="opsuyon-${slugify(def.title)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
