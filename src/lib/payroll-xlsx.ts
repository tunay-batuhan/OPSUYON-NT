import "server-only";
import ExcelJS from "exceljs";
import { GROUP_LABEL, type PayCol } from "@/lib/payroll-engine";
import { periodLabel, type PayrollRunView } from "@/lib/payroll-shared";

const NAVY = "FF0A2A63";
const SOFT = "FFEFF3F9";
const MONEY = "#,##0.00";
const GROUP_FILL: Record<string, string> = { bilgi: SOFT, kazanc: "FFE6F5EC", kesinti: "FFFCE8E8", odeme: "FFE5EEFC" };

/**
 * Dönemin bordrosu (.xlsx), müşterinin Excel düzeninde: başlık, grup başlıkları (Kazançlar / Kesintiler / Ödeme),
 * şablondaki sütunlar, personel satırları, TOPLAM satırı ve imza sütunu. Değerler hesaplanmış sayılardır.
 */
export async function buildPayrollXlsx(run: PayrollRunView): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OPSUYON";
  const ws = wb.addWorksheet(periodLabel(run.year, run.month).slice(0, 28), {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cols: PayCol[] = run.columns;
  const n = cols.length + 2; // ad + sütunlar + imza
  const thin = { style: "thin" as const, color: { argb: "FFB8C2D3" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  const title = `${(run.org || run.project).toLocaleUpperCase("tr")} ${periodLabel(run.year, run.month).toLocaleUpperCase("tr")}`;
  ws.addRow([title]);
  ws.mergeCells(1, 1, 1, n);
  ws.getRow(1).height = 24;
  ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  ws.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };

  ws.addRow([`MAAŞ BORDROSU · ${run.project}${run.status === "approved" ? "" : " · TASLAK (onaylanmadı)"}`]);
  ws.mergeCells(2, 1, 2, n);
  ws.getCell(2, 1).font = { bold: true, size: 12 };
  ws.getCell(2, 1).alignment = { horizontal: "center" };

  // 3. satır: grup başlıkları · 4. satır: sütun başlıkları
  const groupRow = ws.addRow(["ADI SOYADI", ...cols.map((c) => GROUP_LABEL[c.group].toLocaleUpperCase("tr")), "İMZA"]);
  const headRow = ws.addRow(["", ...cols.map((c) => c.label.toLocaleUpperCase("tr")), ""]);
  ws.mergeCells(3, 1, 4, 1);
  ws.mergeCells(3, n, 4, n);
  let start = 0;
  for (let i = 1; i <= cols.length; i++) {
    if (i === cols.length || cols[i].group !== cols[start].group) {
      if (i - start > 1) ws.mergeCells(3, start + 2, 3, i + 1);
      start = i;
    }
  }
  for (const r of [groupRow, headRow]) {
    r.height = r === headRow ? 30 : 18;
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = cols[col - 2];
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c ? GROUP_FILL[c.group] : SOFT } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border;
    });
  }

  const round = (v: number) => Math.round(v * 100) / 100;
  for (const l of run.lines) {
    const row = ws.addRow([l.full_name, ...cols.map((c) => (c.kind === "text" ? (l.texts[c.code] ?? "") : round(l.values[c.code] ?? 0))), ""]);
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = cols[col - 2];
      cell.border = border;
      if (c && c.kind !== "text") cell.numFmt = MONEY;
      if (col === 1) cell.font = { bold: true };
      if (c?.group === "odeme" && Number(cell.value) < 0) cell.font = { color: { argb: "FFCC2626" }, bold: true };
      cell.alignment = { vertical: "middle", horizontal: col === 1 || c?.kind === "text" ? "left" : "right" };
    });
  }

  const total = ws.addRow(["TOPLAM", ...cols.map((c) => (c.total && c.kind !== "text" ? (run.totals[c.code] ?? 0) : "")), ""]);
  total.eachCell({ includeEmpty: true }, (cell, col) => {
    const c = cols[col - 2];
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
    cell.border = border;
    if (c && c.kind !== "text") cell.numFmt = MONEY;
    cell.alignment = { horizontal: col === 1 ? "left" : "right" };
  });

  ws.addRow([]);
  ws.addRow(["Formüller:"]).font = { bold: true, size: 9, color: { argb: "FF64748B" } };
  for (const c of cols.filter((x) => x.kind === "formula")) {
    ws.addRow([`${c.label} = ${c.formula}`]).font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  }
  ws.addRow(["OPSUYON maaş hesaplamasından oluşturulmuştur. * Elle girilen (formülü ezilen) hücreler ekranda sarı görünür."]).font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  ws.getColumn(1).width = 26;
  cols.forEach((c, i) => (ws.getColumn(i + 2).width = c.kind === "text" ? 14 : 12));
  ws.getColumn(n).width = 16;
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
