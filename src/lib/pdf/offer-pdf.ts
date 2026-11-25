import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { LOGO_PNG_B64, LOGO_RATIO } from "@/lib/pdf/logo";
import { BRAND_TAGLINE } from "@/lib/brand";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { DEFAULT_COST_PARAMS, OFFER_STATUS, calcOffer, costTerms, formatRate, r2, type CostParams, type OfferLineInput, type OfferStatus } from "@/lib/offer-calc";

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
  /** şirket kâr payı % ve maliyet tablosu oranları */
  profit_pct: number;
  cost_params?: CostParams;
  /** maliyet karşılaştırma teklife eklenmiş mi (false → yalnızca teklif: kâr kartları, karşılaştırma ve maliyet dökümü basılmaz) */
  compare?: boolean;
  valid_until: string | null;
  created_at: string;
  creator: string | null;
  lines: OfferLineInput[];
};


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
 *  - Her sayfada OPSUYON logolu başlık, lacivert/turuncu şerit.
 * Yalnızca teklif: başlık + künye, müşteri kartı, teklif tablosu (hizmetler, toplam, KDV, genel toplam), not ve imza.
 * Maliyet karşılaştırmalı, sırasıyla: "OPSUYON'dan hizmet alırsanız" aylık / yıllık net kâr kartları; OPSUYON FİYAT
 * TEKLİFİ (seçilen personel × kişi başı OPSUYON bedeli, KDV, genel toplam); MALİYET ANALİZ TABLOSU ("Bu hizmeti dışarıdan
 * satın alırsanız": maliyet kalemi girilmeyen hizmet varsa dışarıdan alınan bedeller tablosu, girilenler için Excel'deki
 * dökümün tamamı ve şartlar). 1. sayfanın altında sabit imza alanı. Son sayfa "OPSUYON ile kazancınız": "Hizmet satın
 * alma / OPSUYON ile" karşılaştırması ve operasyonel avantajlar.
 * Yalnızca teklifte de son sayfa "OPSUYON ile kazancınız" (yalnızca operasyonel avantajlar). Tablolar sayfa arasında
 * bölünmez. Tutarlar ekrandaki hesapla aynı fonksiyondan.
 */
export async function buildOfferPdf(o: OfferPdfData): Promise<Uint8Array> {
  const W = 595.28;
  const H = 841.89;
  const M = 48; // yatay kenar boşluğu
  const c = await start(`Teklif ${o.offer_no} - ${o.customer_name}`);
  const { doc, regular, bold } = c;
  const calc = calcOffer(o.lines, o.vat_rate, o.fee_per_person, o.profit_pct, o.cost_params ?? DEFAULT_COST_PARAMS);
  const TW = W - 2 * M;
  const cmp = o.compare !== false;
  // tabloda kişi sayısı girilmiş hizmetler (hiç yoksa adı yazılanlar)
  const named = calc.lines.filter((x) => x.service);
  const shown = named.some((x) => x.people > 0) ? named.filter((x) => x.people > 0) : named;
  // karşılaştırmalı teklifte 3+ hizmet: ilk sayfaya sığması için satırlar ve kutular biraz sıkışır (6+ hizmette daha da)
  const tight = cmp && shown.length > 2;
  const dense = tight && shown.length > 5;
  const ry = dense ? 10.5 : tight ? 11.5 : 13; // satır içi yazı taban çizgisi

  /* ---- zemin: OPSUYON başlığı ---- */
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_B64, "base64"));
  const paintBackground = (p: PDFPage) => {
    p.drawRectangle({ x: 0, y: H - 7, width: W, height: 7, color: NAVY });
    p.drawRectangle({ x: 0, y: H - 9.5, width: W, height: 2.5, color: ORANGE });
    const lw = 128;
    p.drawImage(logo, { x: M, y: H - 34 - lw * LOGO_RATIO, width: lw, height: lw * LOGO_RATIO });
    const site = "opsuyon.com";
    p.drawText(site, { x: W - M - regular.widthOfTextAtSize(site, 9), y: H - 44, size: 9, font: regular, color: MUTED });
    const tag = BRAND_TAGLINE;
    p.drawText(tag, { x: W - M - regular.widthOfTextAtSize(tag, 8), y: H - 56, size: 8, font: regular, color: MUTED });
    p.drawLine({ start: { x: M, y: H - 80 }, end: { x: W - M, y: H - 80 }, thickness: 0.6, color: LINE });
    // alt şerit
    p.drawRectangle({ x: 0, y: 0, width: W, height: 4, color: NAVY });
  };
  const top = H - 102; // içeriğin başladığı y
  const bottom = 64; // içeriğin inebileceği en alt y (altında sayfa bilgisi)

  let page: PDFPage = doc.addPage([W, H]);
  paintBackground(page);
  let y = top;
  const text = (s: string, x: number, yy: number, size = 9.5, font = regular, color: RGB = INK) => page.drawText(s, { x, y: yy, size, font, color });
  const right = (s: string, xr: number, yy: number, size = 9.5, font = regular, color: RGB = INK) => text(s, xr - font.widthOfTextAtSize(s, size), yy, size, font, color);
  /* ---- 1. sayfanın altı (alt bilginin hemen üstü), sabit: imza alanı ---- */
  const sigH = 50; // imza çizgisinin başlıktan uzaklığı
  const footH = sigH + 4;
  {
    const fy = bottom + footH; // alanın üstü
    page.drawLine({ start: { x: M, y: fy + 8 }, end: { x: W - M, y: fy + 8 }, thickness: 0.5, color: LINE });
    const sigW = (TW - 30) / 2;
    text("Müşteri onayı", M, fy - 10, 9, bold, NAVY);
    text("Ad soyad · imza · kaşe", M, fy - 22, 8, regular, MUTED);
    page.drawLine({ start: { x: M, y: fy - sigH }, end: { x: M + sigW, y: fy - sigH }, thickness: 0.6, color: MUTED, dashArray: [3, 2] });
    const sx = M + sigW + 30;
    text("Saygılarımızla,", sx, fy - 10, 9, regular, MUTED);
    text("OPSUYON", sx, fy - 24, 11, bold, NAVY);
    if (o.creator) text(fit(o.creator, sigW, 9, regular), sx, fy - 37, 9, regular, INK);
    page.drawLine({ start: { x: sx, y: fy - sigH }, end: { x: W - M, y: fy - sigH }, thickness: 0.6, color: MUTED, dashArray: [3, 2] });
  }
  /** İçeriğin inebileceği en alt y: 1. sayfada imza alanının üstü, sonraki sayfalarda alt bilginin üstü. */
  let limit = bottom + footH + 18;

  const newPage = () => {
    page = doc.addPage([W, H]);
    paintBackground(page);
    y = top;
    limit = bottom;
  };
  /** h kadar yer yoksa yeni sayfa. */
  const ensure = (h: number) => {
    if (y - h < limit) newPage();
  };
  /** Bir bütün (tablo) bu sayfaya sığmıyorsa yeni sayfada başlasın; tek sayfadan uzunsa ancak o zaman bölünür. */
  const keepTogether = (h: number, min = 80) => ensure(h <= top - bottom ? h : min);

  /* ---- başlık + künye ---- */
  text("HİZMET TEKLİFİ", M, y - 20, 21, bold, NAVY);
  text(cmp ? "OPSUYON ile fiyat avantajınız" : "Hizmet bedeli teklifi", M, y - 36, 10, regular, MUTED);
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

  /* ---- en başta: büyük Aylık / Yıllık net kâr kartları (maliyet karşılaştırmalı teklif) ---- */
  const loss = cmp && calc.monthly_profit < 0;
  const heroH = tight ? 58 : 70;
  const gap = 10;
  const half = (TW - gap) / 2;
  if (cmp) {
    const hero = (x: number, period: string, value: number, color: RGB, sub: RGB) => {
      roundRect(page, x, y, half, heroH, 9, { color });
      text(fit("OPSUYON'DAN HİZMET ALIRSANIZ", half - 32, 7.5, bold), x + 16, y - (tight ? 15 : 18), 7.5, bold, sub);
      text(`${period} NET KÂRINIZ`, x + 16, y - (tight ? 26 : 30), 9.5, bold, WHITE);
      const hs = tight ? 19 : 22;
      text(fit(formatMoney(value), half - 32, hs, bold), x + 16, y - (tight ? 48 : 57), hs, bold, WHITE);
    };
    hero(M, "AYLIK", calc.monthly_profit, loss ? BAD : NAVY, rgb(0.78, 0.85, 0.97));
    hero(M + half + gap, "YILLIK", calc.yearly_profit, loss ? BAD : ORANGE, rgb(1, 0.93, 0.84));
    y -= heroH + (tight ? 12 : 16);
  }

  /* ---- fiyat tablosu: başlık şeridi + hizmet satırları + toplamlar ---- */
  const cols = [
    { w: 178, align: "left" as const },
    { w: 72, align: "center" as const },
    { w: 120, align: "right" as const },
    { w: TW - 370, align: "right" as const },
  ];
  const cell = (str: string, ci: number, yy: number, font: PDFFont, color: RGB, size = 9.5) => {
    let x = M;
    for (let i = 0; i < ci; i++) x += cols[i].w;
    const col = cols[ci];
    const t = fit(str, col.w - 16, size, font);
    const tw = font.widthOfTextAtSize(t, size);
    const tx = col.align === "right" ? x + col.w - 8 - tw : col.align === "center" ? x + (col.w - tw) / 2 : x + 10;
    text(t, tx, yy, size, font, color);
  };
  const rowH = dense ? 15.5 : tight ? 17 : 19;
  type PriceRow = { service: string; people: number; unit: number; monthly: number };
  /** Turuncu başlık + lacivert sütun başlığı + satırlar + alt toplam satırları ([etiket, tutar]; sonuncusu vurgulu). */
  const priceTable = (title: string, labels: string[], rows: PriceRow[], people: number, totals: [string, number][]) => {
    const tableHead = () => {
      page.drawRectangle({ x: M, y: y - 22, width: TW, height: 22, color: NAVY });
      labels.forEach((l, i) => cell(l, i, y - 14.5, bold, WHITE, 8.5));
      y -= 22;
    };
    keepTogether(26 + 22 + rowH * (rows.length + totals.length) + 2, 26 + 22 + rowH * 3);
    roundRect(page, M, y, TW, 26, 8, { color: ORANGE }, "top");
    text(title, M + (TW - bold.widthOfTextAtSize(title, 13)) / 2, y - 17.5, 13, bold, WHITE);
    y -= 26;
    tableHead();
    rows.forEach((l, i) => {
      if (y - rowH < limit) {
        newPage();
        tableHead();
      }
      page.drawRectangle({ x: M, y: y - rowH, width: TW, height: rowH, color: i % 2 ? rgb(0.975, 0.98, 0.99) : WHITE });
      page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.5, color: LINE });
      cell(l.service, 0, y - ry, bold, INK);
      cell(formatNumber(l.people), 1, y - ry, regular, INK);
      cell(formatMoney(l.unit), 2, y - ry, regular, INK);
      cell(formatMoney(l.monthly), 3, y - ry, regular, INK);
      y -= rowH;
    });
    ensure(rowH * totals.length);
    roundRect(page, M, y, TW, rowH * totals.length, 8, { color: SOFT, borderColor: LINE, borderWidth: 0.6 }, "bottom");
    totals.forEach(([label, value], i) => {
      const last = i === totals.length - 1;
      if (i === 0) cell(formatNumber(people), 1, y - ry, bold, INK);
      cell(label, 2, y - ry, bold, last ? NAVY : INK, last ? 10 : 9.5);
      cell(formatMoney(value), 3, y - ry, bold, last ? NAVY : INK, last ? 10 : 9.5);
      y -= rowH;
    });
    y -= tight ? 10 : 14;
  };
  const LABELS = ["Satın alınan hizmet", "Kişi sayısı", "Kişi başı bedel", "Aylık bedel (KDV hariç)"];
  /** Müşterinin hizmeti dışarıdan satın aldığı bedeller (KDV ve KDV dahil genel toplamla). */
  const outsideTable = (title: string) =>
    priceTable(title, LABELS, shown.map((l) => ({ service: l.service, people: l.people, unit: l.unit_price, monthly: l.monthly_total })), calc.total_people, [
      ["TOPLAM", calc.monthly_base],
      [`KDV %${formatRate(o.vat_rate)}`, calc.monthly_vat],
      ["GENEL TOPLAM", calc.current_total],
    ]);

  /** Not: ilk tablonun hemen altından başlar (teklife yazılan not; yalnızca teklifte tutarların aylık ve KDV hariç olduğu). */
  const drawNotes = () => {
    const notes = [
      ...(cmp ? [] : ["Tutarlar aylıktır; kişi başı bedeller KDV hariçtir."]),
      ...(o.notes ? [`Not: ${o.notes}`] : []),
    ];
    if (!notes.length) return;
    y += tight ? 4 : 6; // tablonun alt boşluğundan biraz geri: not tabloya yakın dursun
    for (const n of notes) {
      for (const line of wrap(n, TW, 8.5, regular)) {
        ensure(12);
        text(line, M, y - 8.5, 8.5, regular, MUTED);
        y -= 11.5;
      }
      y -= 3;
    }
    y -= 12;
  };

  let comparison: OfferComparison | null = null;
  if (!cmp) {
    /* ---- yalnızca teklif: teklif edilen hizmetler ---- */
    outsideTable("TEKLİF EDİLEN HİZMETLER");
    drawNotes();
  } else {
    /* ---- 1) OPSUYON fiyat teklifi: seçilen personel × kişi başı OPSUYON bedeli ---- */
    priceTable(
      "OPSUYON FİYAT TEKLİFİ",
      ["Seçilen personel", "Kişi sayısı", "Kişi başı bedel", "Aylık bedel (KDV hariç)"],
      shown.map((l) => ({ service: l.service, people: l.people, unit: o.fee_per_person, monthly: r2(l.people * o.fee_per_person) })),
      calc.total_people,
      [
        ["TOPLAM", calc.offer_net],
        ...(calc.offer_vat > 0 ? [[`KDV %${formatRate(calc.fee_vat)}`, calc.offer_vat] as [string, number]] : []),
        ["GENEL TOPLAM", calc.offer_total],
      ],
    );
    drawNotes();

    /* ---- 2) maliyet analiz tablosu: bu hizmeti dışarıdan satın alırsanız ---- */
    const costLines = calc.lines.filter((l) => l.cost && l.service);
    const PER_TABLE = 4; // Excel'deki gibi tabloda en çok 4 görevli sütunu
    const DUMP_LH = 10.4;
    /** Döküm tablosunun ölçüleri (görevli adı sütuna sığmıyorsa iki satıra bölünür, kesilmez). */
    const dumpLayout = (group: typeof costLines) => {
      const lw = group.length >= 3 ? 205 : 250; // kalem sütunu
      const vw = (TW - lw) / group.length;
      const names = group.map((l) => wrap(l.service, vw - 12, 8.5, bold).slice(0, 2));
      const headH = 16 + Math.max(...names.map((n) => n.length)) * 10;
      return { lw, vw, names, headH, height: headH + group[0].cost!.rows.length * DUMP_LH + 12 };
    };
    const summary = !shown.every((l) => l.cost);
    // başlık, altındaki ilk tabloyla aynı sayfada (özet tablo ya da ilk döküm); sığmıyorsa birlikte yeni sayfaya
    const firstH = summary
      ? 26 + 22 + rowH * (shown.length + 3) + 2
      : costLines.length ? 10 + dumpLayout(costLines.slice(0, PER_TABLE)).height : 0;
    keepTogether(46 + firstH, 170);
    text("MALİYET ANALİZ TABLOSU", M, y - 14, 15, bold, NAVY);
    text("Bu hizmeti dışarıdan satın alırsanız", M, y - 29, 10.5, bold, ORANGE);
    y -= 46;
    if (summary) {
      // maliyet kalemi girilmemiş hizmet var: dışarıdan alınan bedeller (tümü) özet tabloda
      outsideTable("DIŞARIDAN SATIN ALINAN HİZMETLER");
    }
    // maliyet kalemi girilen hizmetler: Excel'deki "TEKLİF DETAYI"nın tamamı; görevliler yan yana sütun.
    // Her döküm tablosu bütün halinde bir sayfada (sığmıyorsa yeni sayfada başlar).
    for (let t = 0; t < costLines.length; t += PER_TABLE) {
      const group = costLines.slice(t, t + PER_TABLE);
      const { lw, vw, names, headH, height } = dumpLayout(group);
      keepTogether((t === 0 ? 10 : 0) + height, 130);
      if (t === 0) {
        text("Kişi başı aylık maliyet dökümü. Soluk satırlar çalışanın ücretinden kesilen tutarlardır; işveren maliyetine ayrıca eklenmez.", M, y, 7.6, regular, MUTED);
        y -= 10;
      }
      const lh = DUMP_LH;
      const fs = 7.5;
      const colHead = () => {
        roundRect(page, M, y, TW, headH, 7, { color: NAVY }, "top");
        text("Kalem", M + 8, y - headH / 2 - 3, 8.5, bold, WHITE);
        group.forEach((l, gi) => {
          const xr = M + lw + (gi + 1) * vw - 8;
          names[gi].forEach((name, ni) => text(name, xr - bold.widthOfTextAtSize(name, 8.5), y - 11.5 - ni * 10, 8.5, bold, WHITE));
          const ppl = `${formatNumber(l.people)} kişi`;
          text(ppl, xr - regular.widthOfTextAtSize(ppl, 7), y - headH + 4.5, 7, regular, rgb(0.78, 0.85, 0.97));
        });
        y -= headH;
      };
      colHead();
      let segTop = y; // çerçevesi çizilecek parçanın üstü (sayfa kırılınca yenilenir)
      const frame = () => page.drawRectangle({ x: M, y, width: TW, height: segTop - y, borderColor: LINE, borderWidth: 0.6 });
      const base = group[0].cost!.rows;
      base.forEach((r, ri) => {
        if (y - lh < limit) {
          frame();
          newPage();
          colHead();
          segTop = y;
        }
        if (r.kind === "section") {
          page.drawRectangle({ x: M, y: y - lh, width: TW, height: lh, color: SOFT });
          text(r.label, M + 8, y - 7.5, 6.4, bold, MUTED);
        } else {
          const strong = r.kind === "total" || r.kind === "subtotal";
          const font = strong ? bold : regular;
          if (r.kind === "total") page.drawRectangle({ x: M, y: y - lh, width: TW, height: lh, color: rgb(1, 0.95, 0.86) });
          const color = r.kind === "info" ? MUTED : INK;
          text(fit(r.label, lw - 14, fs, font), M + 8, y - 7.7, fs, font, color);
          group.forEach((l, gi) => {
            const v = l.cost!.rows[ri];
            const str = v.kind === "count" ? formatNumber(v.value) : formatMoney(v.value);
            text(str, M + lw + (gi + 1) * vw - 8 - font.widthOfTextAtSize(str, fs), y - 7.7, fs, font, color);
          });
          page.drawLine({ start: { x: M, y: y - lh }, end: { x: W - M, y: y - lh }, thickness: 0.3, color: LINE });
        }
        y -= lh;
      });
      frame();
      y -= 12;
    }
    /* ---- şartlar ve koşullar: maliyet analiz tablosunun hemen altında; sığmazsa yazı küçülür (en küçüğünde de sığmazsa yeni sayfa) ---- */
    if (costLines.length) {
      const terms = costTerms(o.cost_params ?? DEFAULT_COST_PARAMS);
      const sizes = [
        { fs: 7.6, lh: 9.5, head: 17 },
        { fs: 7, lh: 8.6, head: 15 },
        { fs: 6.4, lh: 7.7, head: 13 },
        { fs: 5.8, lh: 6.9, head: 12 },
      ];
      const measure = (z: (typeof sizes)[number]) => {
        const ls = terms.map((term) => wrap(term, TW - 12, z.fs, regular));
        return { z, ls, h: z.head + ls.reduce((p, l) => p + l.length * z.lh + 2, 0) };
      };
      const fit_ = sizes.map(measure).find((m) => y - m.h >= limit);
      const { z, ls } = fit_ ?? measure(sizes[0]);
      if (!fit_) newPage();
      text("ŞARTLAR VE KOŞULLAR", M, y - 7, z.fs + 0.9, bold, NAVY);
      y -= z.head;
      for (const lines of ls) {
        text("•", M, y, z.fs, bold, ORANGE);
        lines.forEach((l, li) => text(l, M + 10, y - li * z.lh, z.fs, regular, INK));
        y -= lines.length * z.lh + 2;
      }
    }
    /* ---- 3) karşılaştırma: hizmet satın alma vs OPSUYON ile (son sayfada) ---- */
    const cmpRows: [string, string, string][] = [
      ["Personel maliyeti", formatMoney(calc.monthly_base - calc.profit_share_total), formatMoney(calc.monthly_base - calc.profit_share_total)],
      [`Şirket kâr payı (%${formatRate(o.profit_pct)})`, formatMoney(calc.profit_share_total), "—"],
      [`KDV (%${formatRate(o.vat_rate)})`, formatMoney(calc.monthly_vat), "—"],
      [`OPSUYON hizmet bedeli (${formatNumber(calc.total_people)} kişi × ${formatMoney(o.fee_per_person)})`, "—", formatMoney(calc.offer_net)],
      ...(calc.offer_vat > 0 ? [[`OPSUYON hizmet bedeli KDV (%${formatRate(calc.fee_vat)})`, "—", formatMoney(calc.offer_vat)] as [string, string, string]] : []),
    ];
    // tablo son sayfada (OPSUYON ile kazancınız), operasyonel avantajların üstünde çizilir
    comparison = { rows: cmpRows, current: formatMoney(calc.current_total), opsuyon: formatMoney(calc.opsuyon_total), loss };
  }

  /* ---- sayfa bilgisi (tanıtım sayfası hariç) ---- */
  const pages = doc.getPages();
  const fy = bottom - 16;
  pages.forEach((pg, i) => {
    const note = `Teklif no ${o.offer_no} · opsuyon.com · ${fmtNow()}`;
    pg.drawText(note, { x: M, y: fy, size: 7.5, font: regular, color: MUTED });
    const label = `Sayfa ${i + 1} / ${pages.length + 1}`;
    pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: fy, size: 7.5, font: regular, color: MUTED });
  });

  await advantagesPage(doc, regular, bold, comparison);
  return doc.save();
}

/** Son sayfa, maddi kazanç kartları: [başlık, açıklama]. Metinler teklif hesabındaki iki kazanç kalemiyle aynı dili konuşur. */
/** Son sayfa, operasyonel avantajlar: [başlık, açıklama, renk]. Özelliklerin ayrıntısı ayrı katalogdadır; burada FAYDA anlatılır. */
const BENEFITS: [string, string, RGB][] = [
  ["Tek ekrandan yönetim", "Personel, puantaj, izin, bordro ve evraklar tek panelde. Bilgi almak için kimseyi aramanız gerekmez.", rgb(0.122, 0.435, 0.898)],
  ["Anlık denetim", "Devriye turları, verilen görevler ve ziyaretçi kayıtları anında ekranınızda; aksama olduğunda hemen görürsünüz.", rgb(0.05, 0.58, 0.53)],
  ["Kâğıtsız, düzenli arşiv", "Defter, dosya ve dağınık tablolar biter. Her belge proje ve döneme göre saklanır, tek tıkla bulunur.", rgb(0.49, 0.23, 0.93)],
  ["Denetime hazır kayıtlar", "Özlük evrakları, eğitimler ve yıllık izin hakları güncel tutulur; denetimde belge aramakla vakit kaybetmezsiniz.", rgb(0.07, 0.55, 0.3)],
  ["Hızlı çözüm", "Sahadaki sorun fotoğrafıyla anında yöneticiye ulaşır; işler kanıtıyla kapanır, takipsiz kalmaz.", rgb(0.86, 0.2, 0.35)],
  ["Her yerden erişim", "Bilgisayar, tablet ve telefondan çalışır; kurulum gerektirmez. Yönetim nerede olursa olsun sahayı görür.", rgb(0.71, 0.33, 0.04)],
];

/** Aylık maliyet karşılaştırması (hizmet satın alma / OPSUYON ile): satırlar [kalem, hizmet satın alma, OPSUYON ile]. */
type OfferComparison = { rows: [string, string, string][]; current: string; opsuyon: string; loss: boolean };

/**
 * Teklifin son sayfası: "OPSUYON ile kazancınız". Üstte lacivert bant; karşılaştırmalı teklifte AYLIK MALİYET
 * KARŞILAŞTIRMASI tablosu; OPERASYONEL AVANTAJLAR (6 madde) ve alt bant. Karşılaştırma varken kartlar sığması için kısalır.
 */
async function advantagesPage(doc: PDFDocument, regular: PDFFont, bold: PDFFont, comparison: OfferComparison | null) {
  const W = 595.28;
  const H = 841.89;
  const M = 44;
  const TW = W - 2 * M;
  const page = doc.addPage([W, H]);
  const text = (s: string, x: number, y: number, size: number, font: PDFFont, color: RGB) => page.drawText(s, { x, y, size, font, color });
  const lines = (s: string, max: number, size: number, font: PDFFont) => {
    const out: string[] = [];
    let cur = "";
    for (const w of s.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && font.widthOfTextAtSize(next, size) > max) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const LIGHT = rgb(0.78, 0.85, 0.97);

  /* üst bant */
  const bandH = 172;
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: NAVY });
  page.drawRectangle({ x: 0, y: H - bandH - 4, width: W, height: 4, color: ORANGE });
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_B64, "base64"));
  const lw = 132;
  roundRect(page, M, H - 34, lw + 22, lw * LOGO_RATIO + 14, 8, { color: WHITE });
  page.drawImage(logo, { x: M + 11, y: H - 41 - lw * LOGO_RATIO, width: lw, height: lw * LOGO_RATIO });
  const site = "www.opsuyon.com";
  text(site, W - M - bold.widthOfTextAtSize(site, 10.5), H - 56, 10.5, bold, WHITE);
  text("OPSUYON ile kazancınız", M, H - 118, 25, bold, WHITE);
  text("Aynı personel, aynı hizmet; daha düşük maliyet ve sahada tam kontrol.", M, H - 140, 11, regular, LIGHT);
  let y = H - bandH - 4 - 20;

  y -= comparison ? 2 : 10;

  const section = (title: string) => {
    page.drawRectangle({ x: M, y: y - 13, width: 4, height: 15, color: ORANGE });
    text(title, M + 12, y - 11, 12.5, bold, NAVY);
    y -= 26;
  };
  const right = (s: string, xr: number, yy: number, size: number, font: PDFFont, color: RGB) => text(s, xr - font.widthOfTextAtSize(s, size), yy, size, font, color);

  /* aylık maliyet karşılaştırması */
  if (comparison) {
    section("AYLIK MALİYET KARŞILAŞTIRMASI");
    const rh = 19;
    const cw = 118;
    roundRect(page, M, y, TW, 22, 8, { color: NAVY }, "top");
    text("Kalem", M + 12, y - 14.5, 9, bold, WHITE);
    right("Hizmet satın alma", W - M - cw - 10, y - 14.5, 9, bold, WHITE);
    right("OPSUYON ile", W - M - 10, y - 14.5, 9, bold, WHITE);
    y -= 22;
    comparison.rows.forEach(([k, cur, ops], i) => {
      page.drawRectangle({ x: M, y: y - rh, width: TW, height: rh, color: i % 2 ? rgb(0.975, 0.98, 0.99) : WHITE });
      page.drawLine({ start: { x: M, y: y - rh }, end: { x: W - M, y: y - rh }, thickness: 0.5, color: LINE });
      text(fit(k, TW - 2 * cw - 24, 9.5, regular), M + 12, y - 13, 9.5, regular, INK);
      right(cur, W - M - cw - 10, y - 13, 9.5, regular, cur === "—" ? MUTED : INK);
      right(ops, W - M - 10, y - 13, 9.5, regular, ops === "—" ? MUTED : INK);
      y -= rh;
    });
    roundRect(page, M, y, TW, rh + 4, 8, { color: SOFT, borderColor: LINE, borderWidth: 0.6 }, "bottom");
    text("Aylık toplam", M + 12, y - 15, 10.5, bold, NAVY);
    right(comparison.current, W - M - cw - 10, y - 15, 10.5, bold, INK);
    right(comparison.opsuyon, W - M - 10, y - 15, 10.5, bold, comparison.loss ? BAD : rgb(0.07, 0.55, 0.3));
    y -= rh + 4 + 20;
  }

  const gap = 14;

  /* operasyonel avantajlar: 2 sütun × 3 satır */
  section("OPERASYONEL AVANTAJLAR");
  const bw = (TW - gap) / 2;
  // karşılaştırma varken kartlar kısalır (sayfa tek parça kalsın)
  const c = comparison ? { bh: 76, rg: 10, ts: 11.5, ty: 22, ds: 8.8, dy: 38, dl: 11.6, n: 3 } : { bh: 118, rg: 14, ts: 13, ty: 28, ds: 9.6, dy: 48, dl: 13, n: 5 };
  BENEFITS.forEach(([title, desc, color], i) => {
    const x = M + (i % 2) * (bw + gap);
    if (i % 2 === 0 && i > 0) y -= c.bh + c.rg;
    roundRect(page, x, y, bw, c.bh, 10, { color: WHITE, borderColor: LINE, borderWidth: 0.8 });
    roundRect(page, x, y, 5, c.bh, 2, { color });
    text(title, x + 20, y - c.ty, c.ts, bold, NAVY);
    lines(desc, bw - 38, c.ds, regular).slice(0, c.n).forEach((l, li) => text(l, x + 20, y - c.dy - li * c.dl, c.ds, regular, INK));
  });
  y -= c.bh + (comparison ? 18 : 28);

  /* alt bant */
  roundRect(page, M, y, TW, 52, 10, { color: NAVY });
  text("Daha Güvenli, Daha Düzenli, Daha Verimli…", M + 18, y - 23, 13.5, bold, WHITE);
  text("Sistemin tüm özellikleri için kataloğumuzu isteyin · www.opsuyon.com", M + 18, y - 40, 9.5, regular, LIGHT);
  const tag = BRAND_TAGLINE;
  text(tag, W - M - regular.widthOfTextAtSize(tag, 9), 30, 9, regular, MUTED);
  text("OPSUYON", M, 30, 9, bold, NAVY);
}

export type OfferReportRow = {
  offer_no: string; customer_name: string; status: OfferStatus; total_people: number; monthly_base: number;
  offer_total: number; monthly_profit: number; yearly_profit: number; created_at: string; creator: string | null;
  /** false → yalnızca teklif: OPSUYON ve kâr sütunları "—" */
  with_comparison?: boolean;
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
    const m = (n: number) => (r.with_comparison === false ? "—" : formatMoney(n));
    drawRow(
      [
        r.offer_no, r.customer_name, formatNumber(r.total_people), formatMoney(r.monthly_base), m(r.offer_total),
        m(r.monthly_profit), m(r.yearly_profit), OFFER_STATUS[r.status].label, formatDate(r.created_at), r.creator ?? "—",
      ],
      regular,
      [undefined, undefined, undefined, undefined, undefined, neg(r.monthly_profit), neg(r.yearly_profit) ?? rgb(0.71, 0.33, 0.04), r.status === "accepted" ? OK : r.status === "rejected" ? BAD : undefined],
    );
  }

  footer(c, W, M, "Bu rapor OPSUYON teklif kayıtlarından otomatik oluşturulmuştur.");
  return c.doc.save();
}
