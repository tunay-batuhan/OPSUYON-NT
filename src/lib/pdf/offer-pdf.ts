import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { OFFER_STATUS, calcOffer, formatRate, type OfferLineInput, type OfferStatus } from "@/lib/offer-calc";

// Cari ekstre ve devriye raporuyla aynı görünüm: lacivert başlık bandı, künye, tablo, alt bilgi.
const NAVY = rgb(0.039, 0.165, 0.388);
const ORANGE = rgb(0.961, 0.541, 0.122); // --tone-amber
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.4, 0.45, 0.53);
const LINE = rgb(0.84, 0.87, 0.92);
const SOFT = rgb(0.95, 0.96, 0.98);
const WHITE = rgb(1, 1, 1);
const BAD = rgb(0.8, 0.15, 0.15);
const OK = rgb(0.07, 0.55, 0.3);
const BRAND = rgb(0.122, 0.435, 0.898);

const fmtNow = () =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

type Ctx = { doc: PDFDocument; regular: PDFFont; bold: PDFFont };

async function start(title: string): Promise<Ctx> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setProducer("OPSÜYON");
  const regular = await doc.embedFont(Buffer.from(ROBOTO_REGULAR_B64, "base64"), { subset: true });
  const bold = await doc.embedFont(Buffer.from(ROBOTO_MEDIUM_B64, "base64"), { subset: true });
  return { doc, regular, bold };
}

const fit = (text: string, max: number, size: number, font: PDFFont) => {
  if (font.widthOfTextAtSize(text, size) <= max) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > max) t = t.slice(0, -1);
  return t + "…";
};

const wrap = (text: string, max: number, size: number, font: PDFFont) => {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let cur = "";
    for (const w of para.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && font.widthOfTextAtSize(next, size) > max) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    lines.push(cur);
  }
  return lines.map((l) => fit(l, max, size, font));
};

function footer(c: Ctx, W: number, M: number, note: string) {
  const pages = c.doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M, y: M + 6 }, end: { x: W - M, y: M + 6 }, thickness: 0.5, color: LINE });
    pg.drawText(note, { x: M, y: M - 6, size: 7.5, font: c.regular, color: MUTED });
    const label = `Sayfa ${i + 1} / ${pages.length}`;
    pg.drawText(label, { x: W - M - c.regular.widthOfTextAtSize(label, 7.5), y: M - 6, size: 7.5, font: c.regular, color: MUTED });
  });
}

export type OfferPdfData = {
  offer_no: string;
  customer_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  vat_rate: number;
  fee_per_person: number;
  valid_until: string | null;
  created_at: string;
  creator: string | null;
  lines: OfferLineInput[];
};

/**
 * Tek teklif (A4 dikey): lacivert başlık bandı, müşteri künyesi, "OPSÜYON ile kâra geçin" tablosu (hizmetler,
 * toplam, KDV), OPSÜYON teklifi ve turuncu aylık / yıllık net kâr. Tutarlar ekrandaki hesapla aynı fonksiyondan.
 */
export async function buildOfferPdf(o: OfferPdfData): Promise<Uint8Array> {
  const W = 595.28;
  const H = 841.89;
  const M = 40;
  const c = await start(`Teklif ${o.offer_no} - ${o.customer_name}`);
  const { regular, bold } = c;
  let page: PDFPage = c.doc.addPage([W, H]);
  const text = (s: string, x: number, y: number, size = 9.5, font = regular, color: RGB = INK) => page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xr: number, y: number, size = 9.5, font = regular, color: RGB = INK) => text(s, xr - font.widthOfTextAtSize(s, size), y, size, font, color);
  const calc = calcOffer(o.lines, o.vat_rate, o.fee_per_person);

  /* ---- başlık bandı ---- */
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY });
  text("HİZMET TEKLİFİ", M, H - 40, 20, bold, WHITE);
  text(`Teklif no ${o.offer_no} · ${formatDate(o.created_at)}`, M, H - 60, 10.5, regular, rgb(0.78, 0.85, 0.97));
  right("OPSÜYON", W - M, H - 40, 13, bold, WHITE);
  let y = H - 78 - 26;

  /* ---- müşteri künyesi ---- */
  const info: [string, string][] = [
    ["Müşteri", o.customer_name],
    ...(o.contact_name ? [["Yetkili", o.contact_name] as [string, string]] : []),
    ...([o.phone, o.email].some(Boolean) ? [["İletişim", [o.phone, o.email].filter(Boolean).join(" · ")] as [string, string]] : []),
    ...(o.address ? [["Adres", o.address] as [string, string]] : []),
    ["Geçerlilik", o.valid_until ? `${formatDate(o.valid_until)} tarihine kadar` : "—"],
    ...(o.creator ? [["Hazırlayan", o.creator] as [string, string]] : []),
  ];
  for (const [k, v] of info) {
    text(k, M, y, 9, regular, MUTED);
    const lines = wrap(v, W - 2 * M - 100, 10, bold).slice(0, 3);
    lines.forEach((l, i) => text(l, M + 100, y - i * 13, 10, bold));
    y -= 16 + (lines.length - 1) * 13;
  }
  y -= 10;

  /* ---- turuncu başlık ---- */
  const TW = W - 2 * M;
  page.drawRectangle({ x: M, y: y - 26, width: TW, height: 26, color: ORANGE });
  const head = "OPSÜYON İLE KÂR'A GEÇİN";
  text(head, M + (TW - bold.widthOfTextAtSize(head, 14)) / 2, y - 18, 14, bold, WHITE);
  y -= 26;

  /* ---- hizmet tablosu ---- */
  const cols = [
    { label: "Satın alınan hizmet", w: 175, align: "left" as const },
    { label: "Kişi sayısı", w: 80, align: "center" as const },
    { label: "Kişi başı hizmet bedeli", w: 120, align: "right" as const },
    { label: "Aylık tutar (KDV hariç)", w: TW - 375, align: "right" as const },
  ];
  const cell = (s: string, ci: number, yy: number, font: PDFFont, color: RGB, size = 9.5) => {
    let x = M;
    for (let i = 0; i < ci; i++) x += cols[i].w;
    const col = cols[ci];
    const t = fit(s, col.w - 12, size, font);
    const tw = font.widthOfTextAtSize(t, size);
    const tx = col.align === "right" ? x + col.w - 6 - tw : col.align === "center" ? x + (col.w - tw) / 2 : x + 6;
    text(t, tx, yy, size, font, color);
  };
  const tableHead = () => {
    page.drawRectangle({ x: M, y: y - 26, width: TW, height: 26, color: NAVY });
    cols.forEach((col, i) => cell(col.label, i, y - 17, bold, WHITE, 8.5));
    y -= 26;
  };
  const newPage = () => {
    page = c.doc.addPage([W, H]);
    y = H - M;
  };
  tableHead();
  const rowH = 20;
  for (const l of calc.lines.filter((x) => x.service)) {
    if (y - rowH < M + 30) {
      newPage();
      tableHead();
    }
    cell(l.service, 0, y - 14, regular, INK);
    cell(formatNumber(l.people), 1, y - 14, regular, INK);
    cell(l.unit_price === null ? "" : formatMoney(l.unit_price), 2, y - 14, regular, INK);
    cell(formatMoney(l.monthly_total), 3, y - 14, regular, INK);
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.5, color: LINE, dashArray: [2, 2] });
    y -= rowH;
  }
  // toplam + KDV + teklif bantları (~230 pt) aynı sayfada kalsın
  if (y - 230 < M + 20) newPage();
  page.drawRectangle({ x: M, y: y - rowH * 2, width: TW, height: rowH * 2, color: SOFT });
  cell(formatNumber(calc.total_people), 1, y - 14, bold, INK);
  cell("TOPLAM", 2, y - 14, bold, INK);
  cell(formatMoney(calc.monthly_base), 3, y - 14, bold, INK);
  y -= rowH;
  cell(`KDV %${formatRate(o.vat_rate)}`, 2, y - 14, bold, INK);
  cell(formatMoney(calc.monthly_vat), 3, y - 14, bold, INK);
  y -= rowH + 12;

  /* ---- OPSÜYON teklifi ---- */
  const band = (label: string, value: string, color: RGB, h = 24, size = 10.5) => {
    page.drawRectangle({ x: M, y: y - h, width: TW, height: h, color });
    text(label, M + 10, y - h / 2 - size / 3, size, bold, WHITE);
    right(value, W - M - 10, y - h / 2 - size / 3, size + 1, bold, WHITE);
    y -= h;
  };
  band("OPSÜYON kişi başı teklif tutarı", formatMoney(o.fee_per_person), NAVY);
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.3, 0.4, 0.6) });
  band(`Toplam teklif tutarı (${formatNumber(calc.total_people)} kişi, aylık)`, formatMoney(calc.offer_total), NAVY);
  y -= 10;
  const loss = calc.monthly_profit < 0;
  band("AYLIK NET KÂR'INIZ", formatMoney(calc.monthly_profit), loss ? BAD : NAVY, 26, 11);
  y -= 10;
  band("YILLIK NET KÂR'INIZ", formatMoney(calc.yearly_profit), loss ? BAD : ORANGE, 40, 16);
  y -= 18;

  /* ---- açıklama + not ---- */
  const notes = [
    `Hesap: Aylık net kâr = hizmet tutarı üzerindeki KDV (%${formatRate(o.vat_rate)}) − OPSÜYON toplam teklif tutarı; yıllık net kâr = aylık × 12.`,
    "Hizmet tutarları müşterinin beyan ettiği son ay (KDV hariç) tutarlardır.",
    ...(o.notes ? [`Not: ${o.notes}`] : []),
  ];
  for (const n of notes) {
    for (const line of wrap(n, TW - 12, 8.5, regular)) {
      if (y < M + 30) break;
      text(line, M + 6, y, 8.5, regular, MUTED);
      y -= 12;
    }
  }

  footer(c, W, M, `Bu teklif OPSÜYON tarafından ${fmtNow()} tarihinde oluşturulmuştur.`);
  return c.doc.save();
}

export type OfferReportRow = {
  offer_no: string; customer_name: string; status: OfferStatus; total_people: number; monthly_base: number;
  offer_total: number; monthly_profit: number; yearly_profit: number; created_at: string; creator: string | null;
};

export type OfferReportSummary = {
  total: number; open: number; accepted: number; rejected: number; acceptRate: number | null; acceptedMonthly: number; yearlyPotential: number;
};

/** Teklif raporu (A4 yatay): süzgeç künyesi, özet kutuları ve sayfa kıran liste. */
export async function buildOfferReportPdf(rows: OfferReportRow[], s: OfferReportSummary, filters: [string, string][]): Promise<Uint8Array> {
  const W = 841.89;
  const H = 595.28;
  const M = 36;
  const c = await start("Teklif Raporu");
  const { regular, bold } = c;
  let page: PDFPage = c.doc.addPage([W, H]);
  const text = (str: string, x: number, yy: number, size = 9, font = regular, color: RGB = INK) => page.drawText(str, { x, y: yy, size, font, color });

  page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: NAVY });
  text("TEKLİF RAPORU", M, H - 34, 18, bold, WHITE);
  text(`Oluşturma ${fmtNow()}`, M, H - 52, 9.5, regular, rgb(0.78, 0.85, 0.97));
  text("OPSÜYON", W - M - bold.widthOfTextAtSize("OPSÜYON", 13), H - 34, 13, bold, WHITE);
  let y = H - 64 - 22;

  const ftxt = filters.length ? filters.map(([k, v]) => `${k}: ${v}`).join("   ·   ") : "Süzgeç yok (tüm teklifler)";
  text(fit(ftxt, W - 2 * M, 9, regular), M, y, 9, regular, MUTED);
  y -= 16;

  const boxes: [string, string, RGB][] = [
    ["Toplam teklif", formatNumber(s.total), BRAND],
    ["Bekleyen (taslak + gönderildi)", formatNumber(s.open), INK],
    ["Kabul / red", `${s.accepted} / ${s.rejected}`, OK],
    ["Kabul oranı", s.acceptRate === null ? "—" : `%${formatNumber(Math.round(s.acceptRate * 1000) / 10)}`, OK],
    ["Kabul edilen aylık OPSÜYON", formatMoney(s.acceptedMonthly), NAVY],
    ["Yıllık kâr potansiyeli", formatMoney(s.yearlyPotential), ORANGE],
  ];
  const gap = 8;
  const bw = (W - 2 * M - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([label, value, color], i) => {
    const x = M + i * (bw + gap);
    page.drawRectangle({ x, y: y - 42, width: bw, height: 42, color: SOFT, borderColor: LINE, borderWidth: 0.7 });
    text(fit(value, bw - 14, 13, bold), x + 8, y - 21, 13, bold, color);
    text(fit(label, bw - 14, 7.5, regular), x + 8, y - 35, 7.5, regular, MUTED);
  });
  y -= 42 + 18;

  const cols: { label: string; w: number; align?: "right" | "center" }[] = [
    { label: "Teklif no", w: 70 },
    { label: "Müşteri", w: 145 },
    { label: "Kişi", w: 32, align: "right" },
    { label: "Aylık matrah", w: 82, align: "right" },
    { label: "OPSÜYON aylık", w: 82, align: "right" },
    { label: "Aylık kâr", w: 76, align: "right" },
    { label: "Yıllık kâr", w: 82, align: "right" },
    { label: "Durum", w: 66, align: "center" },
    { label: "Tarih", w: 56, align: "center" },
    { label: "Hazırlayan", w: W - 2 * M - 691 },
  ];
  const drawRow = (cells: string[], font: PDFFont, colors: (RGB | undefined)[], fill?: RGB, size = 8.5) => {
    if (fill) page.drawRectangle({ x: M, y: y - 18, width: W - 2 * M, height: 18, color: fill });
    let x = M;
    cols.forEach((col, i) => {
      const t = fit(cells[i] ?? "", col.w - 10, size, font);
      const tw = font.widthOfTextAtSize(t, size);
      const tx = col.align === "right" ? x + col.w - 5 - tw : col.align === "center" ? x + (col.w - tw) / 2 : x + 5;
      text(t, tx, y - 12.5, size, font, colors[i] ?? INK);
      x += col.w;
    });
    page.drawLine({ start: { x: M, y: y - 18 }, end: { x: W - M, y: y - 18 }, thickness: 0.5, color: LINE });
    y -= 18;
  };
  const headRow = () => drawRow(cols.map((c2) => c2.label), bold, cols.map(() => MUTED), SOFT, 8);
  headRow();
  if (rows.length === 0) drawRow(["", "Süzgeçlere uyan teklif yok"], regular, [undefined, MUTED]);
  for (const r of rows) {
    if (y - 18 < M + 20) {
      page = c.doc.addPage([W, H]);
      y = H - M;
      headRow();
    }
    const neg = (n: number) => (n < 0 ? BAD : undefined);
    drawRow(
      [
        r.offer_no, r.customer_name, formatNumber(r.total_people), formatMoney(r.monthly_base), formatMoney(r.offer_total),
        formatMoney(r.monthly_profit), formatMoney(r.yearly_profit), OFFER_STATUS[r.status].label, formatDate(r.created_at), r.creator ?? "—",
      ],
      regular,
      [undefined, undefined, undefined, undefined, undefined, neg(r.monthly_profit), neg(r.yearly_profit) ?? rgb(0.71, 0.33, 0.04), r.status === "accepted" ? OK : r.status === "rejected" ? BAD : undefined],
    );
  }

  footer(c, W, M, "Bu rapor OPSÜYON teklif kayıtlarından otomatik oluşturulmuştur.");
  return c.doc.save();
}
