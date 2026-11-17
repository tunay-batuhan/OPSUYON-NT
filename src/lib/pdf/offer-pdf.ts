import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { LOGO_PNG_B64, LOGO_RATIO } from "@/lib/pdf/logo";
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
  doc.setProducer("OPSUYON");
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

/** Merkezin yüklediği antetli kağıt: A4 PDF (ilk sayfa) ya da PNG/JPG. Üst/alt boşluk mm. */
export type OfferLetterhead = { bytes: Uint8Array; mime: string; topMm: number; bottomMm: number };

const MM = 72 / 25.4;

/** Köşeleri yuvarlatılmış dikdörtgen (yalnızca üst, yalnızca alt ya da hepsi). yTop: üst kenarın y'si. */
function roundRect(
  page: PDFPage, x: number, yTop: number, w: number, h: number, r: number,
  opts: { color?: RGB; borderColor?: RGB; borderWidth?: number }, round: "all" | "top" | "bottom" = "all",
) {
  const t = round === "bottom" ? 0 : r;
  const b = round === "top" ? 0 : r;
  const path = `M ${t} 0 H ${w - t} Q ${w} 0 ${w} ${t} V ${h - b} Q ${w} ${h} ${w - b} ${h} H ${b} Q 0 ${h} 0 ${h - b} V ${t} Q 0 0 ${t} 0 Z`;
  page.drawSvgPath(path, { x, y: yTop, ...opts });
}

/**
 * Tek teklif (A4 dikey).
 *  - Antet yüklüyse: her sayfanın zemini antettir (tam sayfa PDF/görsel) ya da yatay antet görseli sayfanın üstüne
 *    oturur; içerik antetin üst ve alt boşluğu arasına yazılır.
 *  - Antet yoksa: OPSUYON logolu başlık, lacivert/turuncu şerit.
 * İçerik: başlık + teklif künyesi, müşteri kartı, "OPSUYON ile kâra geçin" tablosu (hizmetler, toplam, KDV),
 * OPSUYON teklifi, aylık / yıllık net kâr kutuları, açıklama ve imza alanı. Tutarlar ekrandaki hesapla aynı fonksiyondan.
 */
export async function buildOfferPdf(o: OfferPdfData, letterhead?: OfferLetterhead | null): Promise<Uint8Array> {
  const W = 595.28;
  const H = 841.89;
  const M = 48; // yatay kenar boşluğu
  const c = await start(`Teklif ${o.offer_no} - ${o.customer_name}`);
  const { doc, regular, bold } = c;
  const calc = calcOffer(o.lines, o.vat_rate, o.fee_per_person);
  const TW = W - 2 * M;

  /* ---- zemin: antet ya da OPSUYON başlığı ---- */
  let paintBackground: (p: PDFPage) => void;
  let top: number; // içeriğin başladığı y
  let bottom: number; // içeriğin inebileceği en alt y (altında sayfa bilgisi)
  let usesLetterhead = false;
  const lh = letterhead ? await embedLetterhead(doc, letterhead).catch(() => null) : null;
  if (lh && lh.kind === "page") {
    usesLetterhead = true;
    paintBackground = lh.draw;
    top = H - Math.max(letterhead!.topMm * MM, 24);
    bottom = Math.max(letterhead!.bottomMm * MM, 18) + 16;
  } else if (lh && lh.kind === "banner") {
    usesLetterhead = true;
    paintBackground = lh.draw;
    top = H - lh.height - 22;
    bottom = Math.max(letterhead!.bottomMm * MM, 18) + 16;
  } else {
    const logo = await doc.embedPng(Buffer.from(LOGO_PNG_B64, "base64"));
    paintBackground = (p) => {
      p.drawRectangle({ x: 0, y: H - 7, width: W, height: 7, color: NAVY });
      p.drawRectangle({ x: 0, y: H - 9.5, width: W, height: 2.5, color: ORANGE });
      const lw = 128;
      p.drawImage(logo, { x: M, y: H - 34 - lw * LOGO_RATIO, width: lw, height: lw * LOGO_RATIO });
      const site = "opsuyon.com";
      p.drawText(site, { x: W - M - regular.widthOfTextAtSize(site, 9), y: H - 44, size: 9, font: regular, color: MUTED });
      const tag = "Tesis yönetiminde dijital dönüşüm";
      p.drawText(tag, { x: W - M - regular.widthOfTextAtSize(tag, 8), y: H - 56, size: 8, font: regular, color: MUTED });
      p.drawLine({ start: { x: M, y: H - 80 }, end: { x: W - M, y: H - 80 }, thickness: 0.6, color: LINE });
      // alt şerit
      p.drawRectangle({ x: 0, y: 0, width: W, height: 4, color: NAVY });
    };
    top = H - 102;
    bottom = 64;
  }

  let page: PDFPage = doc.addPage([W, H]);
  paintBackground(page);
  let y = top;
  const text = (s: string, x: number, yy: number, size = 9.5, font = regular, color: RGB = INK) => page.drawText(s, { x, y: yy, size, font, color });
  const right = (s: string, xr: number, yy: number, size = 9.5, font = regular, color: RGB = INK) => text(s, xr - font.widthOfTextAtSize(s, size), yy, size, font, color);
  const newPage = () => {
    page = doc.addPage([W, H]);
    paintBackground(page);
    y = top;
  };
  /** h kadar yer yoksa yeni sayfa. */
  const ensure = (h: number) => {
    if (y - h < bottom) newPage();
  };

  /* ---- başlık + künye ---- */
  text("HİZMET TEKLİFİ", M, y - 20, 21, bold, NAVY);
  text("OPSUYON ile kâra geçin", M, y - 36, 10, regular, MUTED);
  const meta: [string, string][] = [
    ["Teklif no", o.offer_no],
    ["Tarih", formatDate(o.created_at)],
    ["Geçerlilik", o.valid_until ? formatDate(o.valid_until) : "—"],
  ];
  meta.forEach(([k, v], i) => {
    const yy = y - 10 - i * 14;
    right(v, W - M, yy, 9.5, bold, INK);
    right(k, W - M - 92, yy, 8.5, regular, MUTED);
  });
  page.drawRectangle({ x: M, y: y - 48, width: 36, height: 3, color: ORANGE });
  y -= 58;

  /* ---- müşteri kartı ---- */
  const details: [string, string][] = [
    ...(o.contact_name ? [["Yetkili", o.contact_name] as [string, string]] : []),
    ...(o.phone ? [["Telefon", o.phone] as [string, string]] : []),
    ...(o.email ? [["E-posta", o.email] as [string, string]] : []),
    ...(o.address ? [["Adres", o.address] as [string, string]] : []),
  ];
  const nameLines = wrap(o.customer_name, TW - 32, 13, bold).slice(0, 2);
  // detaylar iki sütun: yetkili/telefon solda, e-posta/adres sağda (adres iki satıra kadar)
  const colW = (TW - 32 - 16) / 2;
  const detailRows = details.map(([k, v]) => ({ k, lines: wrap(v, colW - 56, 9.5, regular).slice(0, 2) }));
  const leftCol = detailRows.filter((_, i) => i % 2 === 0);
  const rightCol = detailRows.filter((_, i) => i % 2 === 1);
  const colH = (rows: typeof detailRows) => rows.reduce((s, r) => s + 13 * r.lines.length + 3, 0);
  const cardH = 26 + nameLines.length * 16 + (details.length ? 6 + Math.max(colH(leftCol), colH(rightCol)) : 0) + 8;
  roundRect(page, M, y, TW, cardH, 8, { color: SOFT, borderColor: LINE, borderWidth: 0.7 });
  page.drawRectangle({ x: M, y: y - cardH + 8, width: 3, height: cardH - 16, color: BRAND });
  text("SAYIN", M + 16, y - 16, 7.5, bold, MUTED);
  nameLines.forEach((l, i) => text(l, M + 16, y - 33 - i * 16, 13, bold, NAVY));
  const dy = y - 33 - nameLines.length * 16 - 4;
  const drawCol = (rows: typeof detailRows, x: number) => {
    let yy = dy;
    for (const r of rows) {
      text(r.k, x, yy, 8, regular, MUTED);
      r.lines.forEach((l, i) => text(l, x + 52, yy - i * 13, 9.5, regular, INK));
      yy -= 13 * r.lines.length + 3;
    }
  };
  drawCol(leftCol, M + 16);
  drawCol(rightCol, M + 16 + colW + 16);
  y -= cardH + 12;

  const intro = `Mevcut hizmet giderleriniz ve OPSUYON ile elde edeceğiniz kazanç aşağıda özetlenmiştir. Tutarlar aylık ve KDV hariçtir; KDV ayrıca gösterilmiştir.`;
  for (const l of wrap(intro, TW, 9.5, regular)) {
    text(l, M, y, 9.5, regular, INK);
    y -= 13;
  }
  y -= 5;

  /* ---- turuncu başlık + hizmet tablosu ---- */
  const cols = [
    { label: "Satın alınan hizmet", w: 168, align: "left" as const },
    { label: "Kişi sayısı", w: 72, align: "center" as const },
    { label: "Kişi başı hizmet bedeli", w: 126, align: "right" as const },
    { label: "Hizmet tutarı (aylık)", w: TW - 366, align: "right" as const },
  ];
  const cell = (s: string, ci: number, yy: number, font: PDFFont, color: RGB, size = 9.5) => {
    let x = M;
    for (let i = 0; i < ci; i++) x += cols[i].w;
    const col = cols[ci];
    const t = fit(s, col.w - 16, size, font);
    const tw = font.widthOfTextAtSize(t, size);
    const tx = col.align === "right" ? x + col.w - 8 - tw : col.align === "center" ? x + (col.w - tw) / 2 : x + 10;
    text(t, tx, yy, size, font, color);
  };
  const rowH = 20;
  const tableTitle = () => {
    roundRect(page, M, y, TW, 28, 8, { color: ORANGE }, "top");
    const head = "OPSUYON İLE KÂR'A GEÇİN";
    text(head, M + (TW - bold.widthOfTextAtSize(head, 13.5)) / 2, y - 19, 13.5, bold, WHITE);
    y -= 28;
  };
  const tableHead = () => {
    page.drawRectangle({ x: M, y: y - 24, width: TW, height: 24, color: NAVY });
    cols.forEach((col, i) => cell(col.label, i, y - 15.5, bold, WHITE, 8.5));
    y -= 24;
  };
  ensure(28 + 24 + rowH * 3);
  tableTitle();
  tableHead();
  const services = calc.lines.filter((x) => x.service);
  services.forEach((l, i) => {
    if (y - rowH < bottom) {
      newPage();
      tableHead();
    }
    page.drawRectangle({ x: M, y: y - rowH, width: TW, height: rowH, color: i % 2 ? rgb(0.975, 0.98, 0.99) : WHITE });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.5, color: LINE });
    cell(l.service, 0, y - 13.5, bold, INK);
    cell(formatNumber(l.people), 1, y - 13.5, regular, INK);
    cell(l.unit_price === null ? "" : formatMoney(l.unit_price), 2, y - 13.5, regular, INK);
    cell(formatMoney(l.monthly_total), 3, y - 13.5, regular, INK);
    y -= rowH;
  });
  // toplam ve KDV: alt köşeleri yuvarlak kutu
  ensure(rowH * 2);
  roundRect(page, M, y, TW, rowH * 2, 8, { color: SOFT, borderColor: LINE, borderWidth: 0.6 }, "bottom");
  cell(formatNumber(calc.total_people), 1, y - 13.5, bold, INK);
  cell("TOPLAM", 2, y - 13.5, bold, INK);
  cell(formatMoney(calc.monthly_base), 3, y - 13.5, bold, INK);
  y -= rowH;
  page.drawLine({ start: { x: M + 366 - 126, y }, end: { x: W - M - 8, y }, thickness: 0.4, color: LINE, dashArray: [2, 2] });
  cell(`KDV %${formatRate(o.vat_rate)}`, 2, y - 13.5, bold, INK);
  cell(formatMoney(calc.monthly_vat), 3, y - 13.5, bold, INK);
  y -= rowH + 12;

  /* ---- OPSUYON teklifi ---- */
  ensure(48 + 10 + 56);
  roundRect(page, M, y, TW, 48, 8, { color: NAVY });
  const offerRow = (label: string, sub: string, value: string, yy: number) => {
    text(label, M + 14, yy, 10, bold, WHITE);
    if (sub) text(sub, M + 14 + bold.widthOfTextAtSize(label, 10) + 6, yy, 8.5, regular, rgb(0.78, 0.85, 0.97));
    right(value, W - M - 14, yy, 11, bold, WHITE);
  };
  offerRow("OPSUYON kişi başı teklif tutarı", "(aylık)", formatMoney(o.fee_per_person), y - 17);
  page.drawLine({ start: { x: M + 14, y: y - 24 }, end: { x: W - M - 14, y: y - 24 }, thickness: 0.4, color: rgb(0.3, 0.4, 0.6) });
  offerRow("Toplam teklif tutarı", `(${formatNumber(calc.total_people)} kişi, aylık)`, formatMoney(calc.offer_total), y - 40);
  y -= 48 + 10;

  /* ---- aylık / yıllık net kâr kutuları ---- */
  const loss = calc.monthly_profit < 0;
  const boxH = 56;
  const leftW = TW * 0.42;
  const gap = 10;
  roundRect(page, M, y, leftW, boxH, 8, { color: loss ? BAD : NAVY });
  text("AYLIK NET KÂR'INIZ", M + 14, y - 19, 9, bold, rgb(0.78, 0.85, 0.97));
  text(fit(formatMoney(calc.monthly_profit), leftW - 28, 17, bold), M + 14, y - 42, 17, bold, WHITE);
  const rx = M + leftW + gap;
  const rw = TW - leftW - gap;
  roundRect(page, rx, y, rw, boxH, 8, { color: loss ? BAD : ORANGE });
  text("YILLIK NET KÂR'INIZ", rx + 14, y - 19, 9, bold, WHITE);
  text(fit(formatMoney(calc.yearly_profit), rw - 28, 22, bold), rx + 14, y - 44, 22, bold, WHITE);
  y -= boxH + 12;

  /* ---- açıklama + not ---- */
  const notes = [
    `Hesap: aylık net kâr = hizmet tutarı üzerindeki KDV (%${formatRate(o.vat_rate)}) − OPSUYON toplam teklif tutarı; yıllık net kâr = aylık × 12. Hizmet tutarları müşterinin beyan ettiği son ay (KDV hariç) tutarlardır.`,
    ...(o.notes ? [`Not: ${o.notes}`] : []),
  ];
  for (const n of notes) {
    for (const line of wrap(n, TW, 8.5, regular)) {
      ensure(12);
      text(line, M, y, 8.5, regular, MUTED);
      y -= 11.5;
    }
    y -= 3;
  }
  y -= 6;

  /* ---- imza alanı ---- */
  ensure(54);
  const half = (TW - 30) / 2;
  text("Müşteri onayı", M, y - 10, 9, bold, NAVY);
  text("Ad soyad · imza · kaşe", M, y - 22, 8, regular, MUTED);
  page.drawLine({ start: { x: M, y: y - 52 }, end: { x: M + half, y: y - 52 }, thickness: 0.6, color: MUTED, dashArray: [3, 2] });
  const sx = M + half + 30;
  text("Saygılarımızla,", sx, y - 10, 9, regular, MUTED);
  text("OPSUYON", sx, y - 24, 11, bold, NAVY);
  if (o.creator) text(fit(o.creator, half, 9, regular), sx, y - 37, 9, regular, INK);
  page.drawLine({ start: { x: sx, y: y - 52 }, end: { x: W - M, y: y - 52 }, thickness: 0.6, color: MUTED, dashArray: [3, 2] });
  y -= 54;

  /* ---- sayfa bilgisi ---- */
  const pages = doc.getPages();
  const fy = bottom - 16;
  pages.forEach((pg, i) => {
    const note = `Teklif no ${o.offer_no}${usesLetterhead ? "" : " · opsuyon.com"} · ${fmtNow()}`;
    pg.drawText(note, { x: M, y: fy, size: 7.5, font: regular, color: MUTED });
    const label = `Sayfa ${i + 1} / ${pages.length}`;
    pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: fy, size: 7.5, font: regular, color: MUTED });
  });
  return doc.save();
}

/**
 * Anteti belgeye gömer. PDF → ilk sayfası tam sayfa zemin. Görsel → A4'e yakın oranda (dikey) ise tam sayfa zemin,
 * yatay bir şeritse sayfanın üstüne tam genişlikte oturur ("banner"; içerik altından başlar).
 */
async function embedLetterhead(doc: PDFDocument, lh: OfferLetterhead):
  Promise<{ kind: "page"; draw: (p: PDFPage) => void } | { kind: "banner"; height: number; draw: (p: PDFPage) => void }> {
  const W = 595.28;
  const H = 841.89;
  if (lh.mime === "application/pdf") {
    const [emb] = await doc.embedPdf(lh.bytes, [0]);
    return { kind: "page", draw: (p) => p.drawPage(emb, { x: 0, y: 0, width: W, height: H }) };
  }
  const img = lh.mime === "image/png" ? await doc.embedPng(lh.bytes) : await doc.embedJpg(lh.bytes);
  const ratio = img.height / img.width;
  if (ratio >= 1.2) return { kind: "page", draw: (p) => p.drawImage(img, { x: 0, y: 0, width: W, height: H }) };
  const h = W * ratio;
  return { kind: "banner", height: h, draw: (p) => p.drawImage(img, { x: 0, y: H - h, width: W, height: h }) };
}

/** Ayarlardaki "Örnek PDF" için örnek teklif (antetin ve boşlukların nasıl durduğunu görmek için). */
export function sampleOfferPdfData(creator: string | null): OfferPdfData {
  const now = new Date();
  const valid = new Date(now.getTime() + 30 * 86400000);
  return {
    offer_no: "T-ÖRNEK",
    customer_name: "Örnek Sitesi Yönetimi",
    contact_name: "Ahmet Yılmaz",
    phone: "0532 123 45 67",
    email: "yonetim@ornek.com",
    address: "Örnek Mah. Deneme Cad. No: 1, İstanbul",
    notes: null,
    vat_rate: 20,
    fee_per_person: 7500,
    valid_until: valid.toISOString().slice(0, 10),
    created_at: now.toISOString(),
    creator,
    lines: [
      { service: "Güvenlik", people: 10, monthly_total: 650000 },
      { service: "Temizlik", people: 4, monthly_total: 220000 },
      { service: "Teknik Personel", people: 2, monthly_total: 140000 },
      { service: "Bahçıvan", people: 1, monthly_total: 58333.33 },
    ],
  };
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
  text("OPSUYON", W - M - bold.widthOfTextAtSize("OPSUYON", 13), H - 34, 13, bold, WHITE);
  let y = H - 64 - 22;

  const ftxt = filters.length ? filters.map(([k, v]) => `${k}: ${v}`).join("   ·   ") : "Süzgeç yok (tüm teklifler)";
  text(fit(ftxt, W - 2 * M, 9, regular), M, y, 9, regular, MUTED);
  y -= 16;

  const boxes: [string, string, RGB][] = [
    ["Toplam teklif", formatNumber(s.total), BRAND],
    ["Bekleyen (taslak + gönderildi)", formatNumber(s.open), INK],
    ["Kabul / red", `${s.accepted} / ${s.rejected}`, OK],
    ["Kabul oranı", s.acceptRate === null ? "—" : `%${formatNumber(Math.round(s.acceptRate * 1000) / 10)}`, OK],
    ["Kabul edilen aylık OPSUYON", formatMoney(s.acceptedMonthly), NAVY],
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
    { label: "OPSUYON aylık", w: 82, align: "right" },
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

  footer(c, W, M, "Bu rapor OPSUYON teklif kayıtlarından otomatik oluşturulmuştur.");
  return c.doc.save();
}
