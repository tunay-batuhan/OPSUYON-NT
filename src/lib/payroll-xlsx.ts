import "server-only";
import ExcelJS from "exceljs";
import { periodLabel, sumLines, type PayrollLineView, type PayrollRunView, type SumKey } from "@/lib/payroll-shared";

type Col = { head: string; group?: "ek" | "kesinti"; width: number; value: (l: PayrollLineView) => string | number; total?: SumKey; money?: boolean };

/** Müşterinin Excel bordrosuyla aynı sütunlar (A–U): ad, maaş, gün, normal, ek kazançlar, toplamlar, kesintiler, ödeme, imza. */
const COLS: Col[] = [
  { head: "ADI SOYADI", width: 24, value: (l) => l.full_name },
  { head: "MAAŞI", width: 12, value: (l) => l.net_salary, money: true },
  { head: "GÜN", width: 6, value: (l) => l.worked_days },
  { head: "NORMAL KAZANÇ", width: 13, value: (l) => l.normal_pay, total: "normal_pay", money: true },
  { head: "YOL", group: "ek", width: 11, value: (l) => l.transport_pay, total: "transport_pay", money: true },
  { head: "YEMEK GÜN", group: "ek", width: 8, value: (l) => l.meal_days },
  { head: "YEMEK KARTI TUTAR", group: "ek", width: 12, value: (l) => l.meal_pay, total: "meal_pay", money: true },
  { head: "EK ÖDEME", group: "ek", width: 12, value: (l) => l.extra_pay, total: "extra_pay", money: true },
  { head: "F.MESAİ GÜN", group: "ek", width: 8, value: (l) => l.overtime_days },
  { head: "F.MESAİ TUTAR", group: "ek", width: 12, value: (l) => l.overtime_pay, total: "overtime_pay", money: true },
  { head: "EK KAZANÇ TOPLAMI", width: 13, value: (l) => Math.round((l.earnings_total - l.normal_pay) * 100) / 100, money: true },
  { head: "KAZANÇLAR TOPLAMI", width: 13, value: (l) => l.earnings_total, total: "earnings_total", money: true },
  { head: "AVANS", group: "kesinti", width: 11, value: (l) => l.advance_total, total: "advance_total", money: true },
  { head: "İHBAR KESİNTİ", group: "kesinti", width: 11, value: (l) => l.ihbar_deduction, total: "ihbar_deduction", money: true },
  { head: "BES", group: "kesinti", width: 10, value: (l) => l.bes_deduction, total: "bes_deduction", money: true },
  { head: "DİĞER KESİNTİ", group: "kesinti", width: 11, value: (l) => l.other_deduction, total: "other_deduction", money: true },
  { head: "KESİNTİLER TOPLAM", width: 13, value: (l) => l.deductions_total, total: "deductions_total", money: true },
  { head: "BANKADAN ÖDENEN", width: 13, value: (l) => l.bank_paid, total: "bank_paid", money: true },
  { head: "YEMEK KARTI ÖDENEN", width: 13, value: (l) => l.meal_card_paid, total: "meal_card_paid", money: true },
  { head: "NET ÖDENEN", width: 13, value: (l) => l.net_paid, total: "net_paid", money: true },
  { head: "İMZA", width: 16, value: () => "" },
];

const NAVY = "FF0A2A63";
const SOFT = "FFEFF3F9";
const MONEY = "#,##0.00";

/** Dönemin bordrosu (.xlsx): başlık, sütun grupları, personel satırları, TOPLAM satırı ve imza sütunu. */
export async function buildPayrollXlsx(run: PayrollRunView): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OPSÜYON";
  const ws = wb.addWorksheet(periodLabel(run.year, run.month).slice(0, 28), {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const n = COLS.length;
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

  // grup başlıkları (3. satır) + sütun başlıkları (4. satır)
  const groupRow = ws.addRow(COLS.map(() => ""));
  const headRow = ws.addRow(COLS.map((c) => c.head));
  const span = (g: "ek" | "kesinti", label: string) => {
    const idx = COLS.map((c, i) => (c.group === g ? i + 1 : 0)).filter(Boolean);
    ws.mergeCells(3, idx[0], 3, idx.at(-1)!);
    ws.getCell(3, idx[0]).value = label;
  };
  span("ek", "EK KAZANÇLAR");
  span("kesinti", "KESİNTİLER");
  COLS.forEach((c, i) => {
    if (!c.group) ws.mergeCells(3, i + 1, 4, i + 1);
    if (!c.group) ws.getCell(3, i + 1).value = c.head;
  });
  for (const r of [groupRow, headRow]) {
    r.height = r === headRow ? 30 : 18;
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border;
    });
  }

  for (const l of run.lines) {
    const row = ws.addRow(COLS.map((c) => c.value(l)));
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = COLS[col - 1];
      cell.border = border;
      if (c.money) cell.numFmt = MONEY;
      if (col === 1) cell.font = { bold: true };
      if ((c.head === "BANKADAN ÖDENEN" || c.head === "NET ÖDENEN") && Number(cell.value) < 0) cell.font = { color: { argb: "FFCC2626" }, bold: true };
      cell.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "right" };
    });
  }

  const t = sumLines(run.lines);
  const total = ws.addRow(COLS.map((c, i) => (i === 0 ? "TOPLAM" : c.total ? t[c.total] : c.head === "EK KAZANÇ TOPLAMI" ? Math.round((t.earnings_total - t.normal_pay) * 100) / 100 : "")));
  total.eachCell({ includeEmpty: true }, (cell, col) => {
    const c = COLS[col - 1];
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
    cell.border = border;
    if (c.money) cell.numFmt = MONEY;
    cell.alignment = { horizontal: col === 1 ? "left" : "right" };
  });

  ws.addRow([]);
  ws.addRow(["Hesap: normal kazanç = maaş ÷ 30 × gün · yol = aylık yol ÷ 30 × gün · net ödenen = kazançlar toplamı − kesintiler · bankadan = net ödenen − yemek kartı. OPSÜYON maaş hesaplamasından oluşturulmuştur."]).font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  COLS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
