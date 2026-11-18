import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { dayFmt, periodLabel, sumLines, tl, type PayrollLineView, type PayrollRunView } from "@/lib/payroll-shared";

// Cari ekstre ve devriye raporuyla aynı görünüm: lacivert başlık bandı, künye, özet kutuları, tablo, alt bilgi.
const NAVY = rgb(0.039, 0.165, 0.388);
const BRAND = rgb(0.122, 0.435, 0.898);
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.4, 0.45, 0.53);
const LINE = rgb(0.84, 0.87, 0.92);
const SOFT = rgb(0.95, 0.96, 0.98);
const OK = rgb(0.07, 0.55, 0.3);
const BAD = rgb(0.8, 0.15, 0.15);
const WHITE = rgb(1, 1, 1);

const FOOTNOTE = "Bu belge OPSUYON maaş hesaplamasından oluşturulmuştur; resmi bordro yerine geçmez.";

const fmtNow = () =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "—";

async function setup(title: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setProducer("OPSUYON");
  const regular = await doc.embedFont(Buffer.from(ROBOTO_REGULAR_B64, "base64"), { subset: true });
  const bold = await doc.embedFont(Buffer.from(ROBOTO_MEDIUM_B64, "base64"), { subset: true });
  const fit = (text: string, max: number, size: number, font: PDFFont) => {
    if (font.widthOfTextAtSize(text, size) <= max) return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > max) t = t.slice(0, -1);
    return t + "…";
  };
  return { doc, regular, bold, fit };
}

function footer(doc: PDFDocument, regular: PDFFont, W: number, M: number) {
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M, y: M + 6 }, end: { x: W - M, y: M + 6 }, thickness: 0.5, color: LINE });
    pg.drawText(FOOTNOTE, { x: M, y: M - 6, size: 7.5, font: regular, color: MUTED });
    const label = `Sayfa ${i + 1} / ${pages.length}`;
    pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: M - 6, size: 7.5, font: regular, color: MUTED });
  });
}

/* ------------------------------------------------------------------ */
/* Bordro pusulası (tek personel, A4 dikey)                            */
/* ------------------------------------------------------------------ */
export async function buildPayslipPdf(run: PayrollRunView, l: PayrollLineView): Promise<Uint8Array> {
  const W = 595.28;
  const H = 841.89;
  const M = 40;
  const period = periodLabel(run.year, run.month);
  const { doc, regular, bold, fit } = await setup(`Bordro - ${l.full_name} - ${period}`);
  const page = doc.addPage([W, H]);
  const text = (s: string, x: number, y: number, size = 9.5, font = regular, color: RGB = INK) => page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xr: number, y: number, size = 9.5, font = regular, color: RGB = INK) => text(s, xr - font.widthOfTextAtSize(s, size), y, size, font, color);

  // başlık bandı
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY });
  text("BORDRO PUSULASI", M, H - 40, 20, bold, WHITE);
  text(fit(`${period} · ${run.org || run.project}`, W - 2 * M - 100, 10.5, regular), M, H - 60, 10.5, regular, rgb(0.78, 0.85, 0.97));
  right("OPSUYON", W - M, H - 40, 13, bold, WHITE);
  let y = H - 78 - 26;

  // künye
  const info: [string, string][] = [
    ["Personel", l.full_name + (l.title ? ` · ${l.title}` : "")],
    ["Firma", run.org || "—"],
    ["Proje", run.project || "—"],
    ["Dönem", period],
    ["Durum", run.status === "approved" ? `Onaylandı · ${fmtDate(run.approvedAt)}` : "Taslak (henüz onaylanmadı)"],
  ];
  for (const [k, v] of info) {
    text(k, M, y, 9, regular, MUTED);
    text(fit(v, W - 2 * M - 110, 10, bold), M + 110, y, 10, bold, k === "Durum" && run.status !== "approved" ? BAD : INK);
    y -= 16;
  }
  y -= 8;

  // özet kutuları
  const boxes: [string, string, RGB][] = [
    ["Net ödenen", `${tl(l.net_paid)} ₺`, l.net_paid < 0 ? BAD : NAVY],
    ["Bankadan ödenen", `${tl(l.bank_paid)} ₺`, l.bank_paid < 0 ? BAD : BRAND],
    ["Yemek kartına", `${tl(l.meal_card_paid)} ₺`, OK],
  ];
  const gap = 10;
  const bw = (W - 2 * M - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([label, value, color], i) => {
    const x = M + i * (bw + gap);
    page.drawRectangle({ x, y: y - 50, width: bw, height: 50, color: SOFT, borderColor: LINE, borderWidth: 0.7 });
    text(fit(value, bw - 16, 15, bold), x + 10, y - 25, 15, bold, color);
    text(label, x + 10, y - 41, 8, regular, MUTED);
  });
  y -= 50 + 24;

  // tablo: [açıklama, ayrıntı, tutar]
  const table = (title: string, rows: [string, string, number][], totalLabel: string, total: number, color: RGB) => {
    text(title, M, y, 11.5, bold, NAVY);
    y -= 8;
    page.drawRectangle({ x: M, y: y - 20, width: W - 2 * M, height: 20, color: SOFT });
    text("Kalem", M + 8, y - 13.5, 8, bold, MUTED);
    text("Ayrıntı", M + 190, y - 13.5, 8, bold, MUTED);
    right("Tutar (₺)", W - M - 8, y - 13.5, 8, bold, MUTED);
    y -= 20;
    for (const [k, detail, amount] of rows) {
      text(k, M + 8, y - 13, 9.5);
      text(fit(detail, 230, 8.5, regular), M + 190, y - 13, 8.5, regular, MUTED);
      right(tl(amount), W - M - 8, y - 13, 9.5);
      page.drawLine({ start: { x: M, y: y - 19 }, end: { x: W - M, y: y - 19 }, thickness: 0.5, color: LINE });
      y -= 19;
    }
    page.drawRectangle({ x: M, y: y - 21, width: W - 2 * M, height: 21, color: SOFT });
    text(totalLabel, M + 8, y - 14, 10, bold);
    right(tl(total), W - M - 8, y - 14, 10, bold, color);
    y -= 21 + 22;
  };

  table(
    "Kazançlar",
    [
      ["Normal kazanç", `${tl(l.net_salary)} ÷ 30 × ${dayFmt(l.worked_days)} gün (eksik ${dayFmt(l.missing_days)} gün)`, l.normal_pay],
      ["Yol", `${tl(l.transport_monthly)} ÷ 30 × ${dayFmt(l.worked_days)} gün`, l.transport_pay],
      ["Fazla mesai", l.overtime_daily > 0 ? `${dayFmt(l.overtime_days)} gün × ${tl(l.overtime_daily)}` : `${tl(l.overtime_monthly)} ÷ 30 × ${dayFmt(l.worked_days)} gün`, l.overtime_pay],
      ["Yemek kartı", l.meal_daily > 0 ? `${dayFmt(l.meal_days)} gün × ${tl(l.meal_daily)}` : `${tl(l.meal_monthly)} ÷ 30 × ${dayFmt(l.worked_days)} gün`, l.meal_pay],
      [l.extra_label ? `Ek ödeme (${l.extra_label})` : "Ek ödeme", "Aylık sabit", l.extra_pay],
    ],
    "Kazanç toplamı",
    l.earnings_total,
    INK,
  );
  table(
    "Kesintiler",
    [
      ["Avans", "Bu ay verilen avansların toplamı", l.advance_total],
      ["İhbar", "", l.ihbar_deduction],
      ["BES", "", l.bes_deduction],
      ["Diğer", l.other_note ?? "", l.other_deduction],
    ],
    "Kesinti toplamı",
    l.deductions_total,
    BAD,
  );

  // net
  page.drawRectangle({ x: M, y: y - 30, width: W - 2 * M, height: 30, color: NAVY });
  text("NET ÖDENEN", M + 10, y - 19.5, 11.5, bold, WHITE);
  right(`${tl(l.net_paid)} ₺`, W - M - 10, y - 19.5, 13, bold, WHITE);
  y -= 30 + 16;
  text(`Bankadan ödenen: ${tl(l.bank_paid)} ₺    ·    Yemek kartına: ${tl(l.meal_card_paid)} ₺`, M, y, 9, regular, MUTED);
  y -= 50;

  // imza
  page.drawLine({ start: { x: W - M - 180, y }, end: { x: W - M, y }, thickness: 0.7, color: MUTED });
  text("Personel imzası", W - M - 180, y - 12, 8.5, regular, MUTED);
  text(`Oluşturma: ${fmtNow()}`, M, y - 12, 8, regular, MUTED);

  footer(doc, regular, W, M);
  return doc.save();
}

/* ------------------------------------------------------------------ */
/* Toplu liste (dönemin tüm personeli, A4 yatay — Excel düzeni)        */
/* ------------------------------------------------------------------ */
type Col = { label: string; w: number; get?: (l: PayrollLineView) => string; total?: (t: ReturnType<typeof sumLines>) => string; strong?: boolean; left?: boolean };

export async function buildPayrollListPdf(run: PayrollRunView): Promise<Uint8Array> {
  const W = 841.89;
  const H = 595.28;
  const M = 22;
  const period = periodLabel(run.year, run.month);
  const { doc, regular, bold, fit } = await setup(`Maaş Bordrosu - ${run.org} - ${period}`);
  const totals = sumLines(run.lines);

  const cols: Col[] = [
    { label: "Adı soyadı", w: 84, get: (l) => l.full_name, left: true },
    { label: "Maaşı", w: 38, get: (l) => tl(l.net_salary) },
    { label: "Gün", w: 20, get: (l) => dayFmt(l.worked_days) },
    { label: "Normal", w: 46, get: (l) => tl(l.normal_pay), total: (t) => tl(t.normal_pay) },
    { label: "Yol", w: 42, get: (l) => tl(l.transport_pay), total: (t) => tl(t.transport_pay) },
    { label: "Yemek", w: 38, get: (l) => tl(l.meal_pay), total: (t) => tl(t.meal_pay) },
    { label: "Ek ödeme", w: 36, get: (l) => tl(l.extra_pay), total: (t) => tl(t.extra_pay) },
    { label: "F. mesai", w: 36, get: (l) => tl(l.overtime_pay), total: (t) => tl(t.overtime_pay) },
    { label: "Kazanç top.", w: 50, get: (l) => tl(l.earnings_total), total: (t) => tl(t.earnings_total), strong: true },
    { label: "Avans", w: 40, get: (l) => tl(l.advance_total), total: (t) => tl(t.advance_total) },
    { label: "İhbar", w: 30, get: (l) => tl(l.ihbar_deduction), total: (t) => tl(t.ihbar_deduction) },
    { label: "BES", w: 30, get: (l) => tl(l.bes_deduction), total: (t) => tl(t.bes_deduction) },
    { label: "Diğer", w: 30, get: (l) => tl(l.other_deduction), total: (t) => tl(t.other_deduction) },
    { label: "Kesinti top.", w: 46, get: (l) => tl(l.deductions_total), total: (t) => tl(t.deductions_total) },
    { label: "Bankadan", w: 48, get: (l) => tl(l.bank_paid), total: (t) => tl(t.bank_paid) },
    { label: "Yemek kartı", w: 42, get: (l) => tl(l.meal_card_paid), total: (t) => tl(t.meal_card_paid) },
    { label: "Net ödenen", w: 50, get: (l) => tl(l.net_paid), total: (t) => tl(t.net_paid), strong: true },
    { label: "İmza", w: 0, get: () => "" },
  ];
  const used = cols.reduce((s, c) => s + c.w, 0);
  cols[cols.length - 1].w = W - 2 * M - used; // imza sütunu kalan genişlik

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, yy: number, size = 7, font = regular, color: RGB = INK) => page.drawText(s, { x, y: yy, size, font, color });

  const band = () => {
    page.drawRectangle({ x: 0, y: H - 56, width: W, height: 56, color: NAVY });
    text(fit(`${(run.org || run.project).toLocaleUpperCase("tr")} ${period.toLocaleUpperCase("tr")} MAAŞ BORDROSU`, W - 2 * M - 90, 15, bold), M, H - 30, 15, bold, WHITE);
    text(fit(`${run.project} · ${run.lines.length} personel · ${run.status === "approved" ? `Onaylandı ${fmtDate(run.approvedAt)}` : "TASLAK (onaylanmadı)"}`, W - 2 * M - 90, 8.5, regular), M, H - 46, 8.5, regular, rgb(0.78, 0.85, 0.97));
    const brand = "OPSUYON";
    text(brand, W - M - bold.widthOfTextAtSize(brand, 12), H - 30, 12, bold, WHITE);
    y = H - 56 - 14;
  };
  const head = () => {
    page.drawRectangle({ x: M, y: y - 24, width: W - 2 * M, height: 24, color: SOFT });
    let cx = M;
    for (const c of cols) {
      // iki satıra bölünebilir başlık
      const words = c.label.split(" ");
      const lines = words.length > 1 && bold.widthOfTextAtSize(c.label, 6.5) > c.w - 4 ? [words.slice(0, -1).join(" "), words.at(-1)!] : [c.label];
      lines.forEach((ln, i) => {
        const s = fit(ln, c.w - 4, 6.5, bold);
        const lw = bold.widthOfTextAtSize(s, 6.5);
        text(s, c.left ? cx + 3 : cx + c.w - 3 - lw, y - (lines.length === 1 ? 15 : 10 + i * 8), 6.5, bold, MUTED);
      });
      cx += c.w;
    }
    y -= 24;
  };
  const row = (cells: string[], strongRow = false, fill?: RGB, colors: (RGB | undefined)[] = []) => {
    const rh = 17;
    if (y - rh < M + 20) {
      page = doc.addPage([W, H]);
      band();
      head();
    }
    if (fill) page.drawRectangle({ x: M, y: y - rh, width: W - 2 * M, height: rh, color: fill });
    let cx = M;
    cols.forEach((c, i) => {
      const font = strongRow || c.strong ? bold : regular;
      const s = fit(cells[i] ?? "", c.w - 4, 6.5, font);
      const lw = font.widthOfTextAtSize(s, 6.5);
      text(s, c.left ? cx + 3 : cx + c.w - 3 - lw, y - 11, 6.5, font, colors[i] ?? INK);
      cx += c.w;
    });
    page.drawLine({ start: { x: M, y: y - rh }, end: { x: W - M, y: y - rh }, thickness: 0.4, color: LINE });
    y -= rh;
  };

  band();
  head();
  for (const l of run.lines) {
    const colors = cols.map((c) => (c.label === "Bankadan" && l.bank_paid < 0) || (c.label === "Net ödenen" && l.net_paid < 0) ? BAD : undefined);
    row(cols.map((c) => c.get?.(l) ?? ""), false, undefined, colors);
  }
  row(cols.map((c, i) => (i === 0 ? `TOPLAM (${run.lines.length})` : c.total?.(totals) ?? "")), true, SOFT);

  y -= 14;
  if (y > M + 30) {
    text(`Oluşturma: ${fmtNow()}   ·   Hesap: normal = maaş ÷ 30 × gün; yol = aylık yol ÷ 30 × gün; net ödenen = kazanç toplamı − kesintiler; bankadan = net ödenen − yemek kartı.`, M, y, 7, regular, MUTED);
  }
  footer(doc, regular, W, M);
  return doc.save();
}
