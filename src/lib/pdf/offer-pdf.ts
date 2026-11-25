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
 * Yalnızca teklif: başlık + künye, müşteri kartı, teklif tablosu (hizmetler, toplam, KDV, genel toplam), not ve imza.
 * Maliyet karşılaştırmalı, sırasıyla: "OPSUYON'dan hizmet alırsanız" aylık / yıllık net kâr kartları; OPSUYON FİYAT
 * TEKLİFİ (seçilen personel × kişi başı OPSUYON bedeli, KDV, genel toplam); MALİYET ANALİZ TABLOSU ("Bu hizmeti dışarıdan
 * satın alırsanız": maliyet kalemi girilmeyen hizmet varsa dışarıdan alınan bedeller tablosu, girilenler için Excel'deki
 * dökümün tamamı ve şartlar); "Hizmet satın alma / OPSUYON ile" karşılaştırması; açıklama ve imza.
 * Son sayfa her zaman "OPSUYON'un avantajları" sayfasıdır (maddi kazanç + operasyonel avantajlar; karşılaştırmalı teklifte
 * o teklifin kazanç tutarlarıyla). Tutarlar ekrandaki hesapla aynı fonksiyondan.
 */
export async function buildOfferPdf(o: OfferPdfData, letterhead?: OfferLetterhead | null): Promise<Uint8Array> {
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
      const tag = BRAND_TAGLINE;
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
    ensure(26 + 22 + rowH * 3);
    roundRect(page, M, y, TW, 26, 8, { color: ORANGE }, "top");
    text(title, M + (TW - bold.widthOfTextAtSize(title, 13)) / 2, y - 17.5, 13, bold, WHITE);
    y -= 26;
    tableHead();
    rows.forEach((l, i) => {
      if (y - rowH < bottom) {
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

  if (!cmp) {
    /* ---- yalnızca teklif: teklif edilen hizmetler ---- */
    outsideTable("TEKLİF EDİLEN HİZMETLER");
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

    /* ---- 2) maliyet analiz tablosu: bu hizmeti dışarıdan satın alırsanız ---- */
    const costLines = calc.lines.filter((l) => l.cost && l.service);
    ensure(shown.every((l) => l.cost) ? 170 : 38 + 26 + 22 + rowH * (shown.length + 3));
    text("MALİYET ANALİZ TABLOSU", M, y - 14, 15, bold, NAVY);
    text("Bu hizmeti dışarıdan satın alırsanız", M, y - 29, 10.5, bold, ORANGE);
    y -= 46;
    if (!shown.every((l) => l.cost)) {
      // maliyet kalemi girilmemiş hizmet var: dışarıdan alınan bedeller (tümü) özet tabloda
      outsideTable("DIŞARIDAN SATIN ALINAN HİZMETLER");
    }
    // maliyet kalemi girilen hizmetler: Excel'deki "TEKLİF DETAYI"nın tamamı; görevliler yan yana sütun
    const PER_TABLE = 4; // Excel'deki gibi tabloda en çok 4 görevli sütunu
    for (let t = 0; t < costLines.length; t += PER_TABLE) {
      const group = costLines.slice(t, t + PER_TABLE);
      ensure(130); // döküm başlığı + birkaç satır aynı sayfada başlasın
      if (t === 0) {
        text("Kişi başı aylık maliyet dökümü. Soluk satırlar çalışanın ücretinden kesilen tutarlardır; işveren maliyetine ayrıca eklenmez.", M, y, 7.6, regular, MUTED);
        y -= 10;
      }
      const lw = group.length >= 3 ? 205 : 250; // kalem sütunu
      const vw = (TW - lw) / group.length;
      const lh = 10.4;
      const fs = 7.5;
      // görevli adı sütuna sığmıyorsa iki satıra bölünür (kesilmez)
      const names = group.map((l) => wrap(l.service, vw - 12, 8.5, bold).slice(0, 2));
      const nameRows = Math.max(...names.map((n) => n.length));
      const headH = 16 + nameRows * 10;
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
        if (y - lh < bottom) {
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
    if (costLines.length) {
      /* şartlar ve koşullar */
      const terms = costTerms(o.cost_params ?? DEFAULT_COST_PARAMS);
      // başlık + tüm maddeler birlikte sığmıyorsa hepsi sonraki sayfaya
      const termLines = terms.map((term) => wrap(term, TW - 12, 7.6, regular));
      ensure(16 + termLines.reduce((p, ls) => p + ls.length * 9.5 + 2, 0));
      text("ŞARTLAR VE KOŞULLAR", M, y - 7, 8.5, bold, NAVY);
      y -= 17;
      for (const ls of termLines) {
        text("•", M, y, 7.6, bold, ORANGE);
        ls.forEach((l, li) => text(l, M + 10, y - li * 9.5, 7.6, regular, INK));
        y -= ls.length * 9.5 + 2;
      }
    }
    /* ---- 3) karşılaştırma: hizmet satın alma vs OPSUYON ile ---- */
    const cmpRows: [string, string, string][] = [
      ["Personel maliyeti", formatMoney(calc.monthly_base - calc.profit_share_total), formatMoney(calc.monthly_base - calc.profit_share_total)],
      [`Şirket kâr payı (%${formatRate(o.profit_pct)})`, formatMoney(calc.profit_share_total), "—"],
      [`KDV (%${formatRate(o.vat_rate)})`, formatMoney(calc.monthly_vat), "—"],
      [`OPSUYON hizmet bedeli (${formatNumber(calc.total_people)} kişi × ${formatMoney(o.fee_per_person)})`, "—", formatMoney(calc.offer_net)],
      ...(calc.offer_vat > 0 ? [[`OPSUYON hizmet bedeli KDV (%${formatRate(calc.fee_vat)})`, "—", formatMoney(calc.offer_vat)] as [string, string, string]] : []),
    ];
    const cw = 118;
    ensure(22 + rowH * (cmpRows.length + 1) + 6);
    roundRect(page, M, y, TW, 22, 8, { color: NAVY }, "top");
    text("Aylık maliyet karşılaştırması", M + 10, y - 14.5, 9, bold, WHITE);
    right("Hizmet satın alma", W - M - cw - 8, y - 14.5, 9, bold, WHITE);
    right("OPSUYON ile", W - M - 8, y - 14.5, 9, bold, WHITE);
    y -= 22;
    for (const [k, cur, ops] of cmpRows) {
      page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.5, color: LINE });
      text(fit(k, TW - 2 * cw - 20, 9.5, regular), M + 10, y - ry, 9.5, regular, INK);
      right(cur, W - M - cw - 8, y - ry, 9.5, regular, cur === "—" ? MUTED : INK);
      right(ops, W - M - 8, y - ry, 9.5, regular, ops === "—" ? MUTED : INK);
      y -= rowH;
    }
    roundRect(page, M, y, TW, rowH + 2, 8, { color: SOFT, borderColor: LINE, borderWidth: 0.6 }, "bottom");
    text("Aylık toplam", M + 10, y - 14, 10, bold, INK);
    right(formatMoney(calc.current_total), W - M - cw - 8, y - 14, 10, bold, INK);
    right(formatMoney(calc.opsuyon_total), W - M - 8, y - 14, 10, bold, loss ? BAD : OK);
    y -= rowH + 2 + 16;
  }

  /* ---- açıklama + not ---- */
  const notes = [
    cmp
      ? `Hesap: aylık net kâr = KDV farkı (KDV − OPSUYON hizmet bedeli${calc.offer_vat > 0 ? `, %${formatRate(calc.fee_vat)} KDV dahil` : ""}) + şirket kâr payı × personel sayısı; yıllık net kâr = aylık × 12. Tutarlar müşterinin beyan ettiği aylık, KDV hariç bedellerdir.`
      : "Tutarlar aylıktır; kişi başı bedeller KDV hariçtir.",
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
  const sigH = tight ? 44 : 52; // imza çizgisinin başlıktan uzaklığı
  ensure(sigH + 2);
  const sigW = (TW - 30) / 2;
  text("Müşteri onayı", M, y - 10, 9, bold, NAVY);
  text("Ad soyad · imza · kaşe", M, y - 22, 8, regular, MUTED);
  page.drawLine({ start: { x: M, y: y - sigH }, end: { x: M + sigW, y: y - sigH }, thickness: 0.6, color: MUTED, dashArray: [3, 2] });
  const sx = M + sigW + 30;
  text("Saygılarımızla,", sx, y - 10, 9, regular, MUTED);
  text("OPSUYON", sx, y - 24, 11, bold, NAVY);
  if (o.creator) text(fit(o.creator, sigW, 9, regular), sx, y - 37, 9, regular, INK);
  page.drawLine({ start: { x: sx, y: y - sigH }, end: { x: W - M, y: y - sigH }, thickness: 0.6, color: MUTED, dashArray: [3, 2] });
  y -= sigH + 2;

  /* ---- sayfa bilgisi (tanıtım sayfası hariç) ---- */
  const pages = doc.getPages();
  const fy = bottom - 16;
  pages.forEach((pg, i) => {
    const note = `Teklif no ${o.offer_no}${usesLetterhead ? "" : " · opsuyon.com"} · ${fmtNow()}`;
    pg.drawText(note, { x: M, y: fy, size: 7.5, font: regular, color: MUTED });
    const label = `Sayfa ${i + 1} / ${pages.length + 1}`;
    pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: fy, size: 7.5, font: regular, color: MUTED });
  });

  await advantagesPage(doc, regular, bold, cmp ? { monthly: calc.monthly_profit, yearly: calc.yearly_profit, vat: calc.vat_saving, share: calc.profit_share_total } : null);
  return doc.save();
}

/** Son sayfa, maddi kazanç kartları: [başlık, açıklama]. Metinler teklif hesabındaki iki kazanç kalemiyle aynı dili konuşur. */
const GAINS: [string, string][] = [
  ["KDV avantajı", "Hizmet faturasına eklenen KDV yükü kalkar. Yerine yalnızca kişi başı sabit OPSUYON hizmet bedelini ödersiniz."],
  ["Şirket kâr payı sizde kalır", "Hizmet firmasının personel maliyetinin üstüne eklediği kâr payını ödemezsiniz; bu tutar bütçenizde kalır."],
  ["Şeffaf maliyet", "Maaş, SGK, yol ve tüm giderleri kalem kalem görürsünüz. Neye ne ödediğinizi bilir, bütçenizi önceden planlarsınız."],
];

/** Son sayfa, operasyonel avantajlar: [başlık, açıklama, renk]. Özelliklerin ayrıntısı ayrı katalogdadır; burada FAYDA anlatılır. */
const BENEFITS: [string, string, RGB][] = [
  ["Tek ekrandan yönetim", "Personel, puantaj, izin, bordro ve evraklar tek panelde. Bilgi almak için kimseyi aramanız gerekmez.", rgb(0.122, 0.435, 0.898)],
  ["Anlık denetim", "Devriye turları, verilen görevler ve ziyaretçi kayıtları anında ekranınızda; aksama olduğunda hemen görürsünüz.", rgb(0.05, 0.58, 0.53)],
  ["Kâğıtsız, düzenli arşiv", "Defter, dosya ve dağınık tablolar biter. Her belge proje ve döneme göre saklanır, tek tıkla bulunur.", rgb(0.49, 0.23, 0.93)],
  ["Denetime hazır kayıtlar", "Özlük evrakları, eğitimler ve yıllık izin hakları güncel tutulur; denetimde belge aramakla vakit kaybetmezsiniz.", rgb(0.07, 0.55, 0.3)],
  ["Hızlı çözüm", "Sahadaki sorun fotoğrafıyla anında yöneticiye ulaşır; işler kanıtıyla kapanır, takipsiz kalmaz.", rgb(0.86, 0.2, 0.35)],
  ["Her yerden erişim", "Bilgisayar, tablet ve telefondan çalışır; kurulum gerektirmez. Yönetim nerede olursa olsun sahayı görür.", rgb(0.71, 0.33, 0.04)],
];

/**
 * Teklifin son sayfası: OPSUYON'u kullanmanın avantajları (antet kullanılmaz). Üstte lacivert bant; karşılaştırmalı
 * teklifte "bu teklifle kazancınız" şeridi (aylık / yıllık); MADDİ KAZANÇ (3 kart) ve OPERASYONEL AVANTAJLAR (6 madde).
 */
async function advantagesPage(doc: PDFDocument, regular: PDFFont, bold: PDFFont, gain: { monthly: number; yearly: number; vat: number; share: number } | null) {
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
  // kazanç tutarı yalnızca müşteri kârdaysa gösterilir
  const show = gain && gain.monthly > 0 ? gain : null;
  const roomy = show ? 0 : 1; // şerit yoksa boşalan yer kartlara dağıtılır

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

  /* bu teklifle kazancınız */
  if (show) {
    const h = 58;
    roundRect(page, M, y, TW, h, 10, { color: ORANGE });
    text("BU TEKLİFLE KAZANCINIZ", M + 18, y - 24, 9.5, bold, WHITE);
    text("KDV farkı + şirket kâr payı", M + 18, y - 40, 8.5, regular, WHITE);
    const col = (label: string, value: string, xr: number) => {
      text(value, xr - bold.widthOfTextAtSize(value, 19), y - 31, 19, bold, WHITE);
      text(label, xr - regular.widthOfTextAtSize(label, 8.5), y - 46, 8.5, regular, WHITE);
    };
    col("yıllık net kâr", formatMoney(show.yearly), W - M - 18);
    col("aylık net kâr", formatMoney(show.monthly), W - M - 18 - 178);
    y -= h + 18;
  } else y -= 6;

  const section = (title: string) => {
    page.drawRectangle({ x: M, y: y - 13, width: 4, height: 15, color: ORANGE });
    text(title, M + 12, y - 11, 12.5, bold, NAVY);
    y -= 26;
  };

  /* maddi kazanç: 3 kart */
  section("MADDİ KAZANÇ");
  const gap = 12;
  const cw = (TW - 2 * gap) / 3;
  const ch = 118 + roomy * 16;
  const amounts = show ? [show.vat > 0 ? `${formatMoney(show.vat)} / ay` : null, show.share > 0 ? `${formatMoney(show.share)} / ay` : null, null] : [null, null, null];
  GAINS.forEach(([title, desc], i) => {
    const x = M + i * (cw + gap);
    roundRect(page, x, y, cw, ch, 10, { color: SOFT, borderColor: LINE, borderWidth: 0.7 });
    page.drawRectangle({ x: x + 14, y: y - 15, width: 26, height: 3, color: ORANGE });
    lines(title, cw - 28, 11.5, bold).slice(0, 2).forEach((l, li) => text(l, x + 14, y - 33 - li * 13.5, 11.5, bold, NAVY));
    const ty = y - 33 - (lines(title, cw - 28, 11.5, bold).slice(0, 2).length - 1) * 13.5 - 17;
    lines(desc, cw - 28, 8.8, regular).slice(0, 6).forEach((l, li) => text(l, x + 14, ty - li * 11.8, 8.8, regular, INK));
    const amt = amounts[i];
    if (amt) text(amt, x + 14, y - ch + 13, 11, bold, rgb(0.07, 0.55, 0.3));
  });
  y -= ch + 22;

  /* operasyonel avantajlar: 2 sütun × 3 satır */
  section("OPERASYONEL AVANTAJLAR");
  const bw = (TW - gap) / 2;
  const bh = 72 + roomy * 12;
  BENEFITS.forEach(([title, desc, color], i) => {
    const x = M + (i % 2) * (bw + gap);
    if (i % 2 === 0 && i > 0) y -= bh + 10;
    roundRect(page, x, y, bw, bh, 9, { color: WHITE, borderColor: LINE, borderWidth: 0.8 });
    roundRect(page, x, y, 5, bh, 2, { color });
    text(title, x + 18, y - 22, 11.5, bold, NAVY);
    lines(desc, bw - 34, 8.8, regular).slice(0, 4).forEach((l, li) => text(l, x + 18, y - 38 - li * 11.8, 8.8, regular, INK));
  });
  y -= bh + 20;

  /* alt bant */
  roundRect(page, M, y, TW, 52, 10, { color: NAVY });
  text("Daha Güvenli, Daha Düzenli, Daha Verimli…", M + 18, y - 23, 13.5, bold, WHITE);
  text("Sistemin tüm özellikleri için kataloğumuzu isteyin · www.opsuyon.com", M + 18, y - 40, 9.5, regular, LIGHT);
  const tag = BRAND_TAGLINE;
  text(tag, W - M - regular.widthOfTextAtSize(tag, 9), 30, 9, regular, MUTED);
  text("OPSUYON", M, 30, 9, bold, NAVY);
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
    offer_no: "OPS-ÖRNEK",
    customer_name: "Örnek Sitesi Yönetimi",
    contact_name: "Ahmet Yılmaz",
    phone: "0532 123 45 67",
    email: "yonetim@ornek.com",
    address: "Örnek Mah. Deneme Cad. No: 1, İstanbul",
    notes: null,
    vat_rate: 20,
    fee_per_person: 7500,
    profit_pct: 5,
    compare: true,
    valid_until: valid.toISOString().slice(0, 10),
    created_at: now.toISOString(),
    creator,
    lines: [
      { service: "Güvenlik", people: 10, unit_price: 65000 },
      { service: "Temizlik", people: 4, unit_price: 0, cost: { gross: 33030, net_transport: 3628, ot_hours: 0, clothing: 650, equipment: 0, ohs: 210, training: 500, insurance: 0, card: 7900, extra: 4700 } },
      { service: "Teknik Personel", people: 2, unit_price: 70000 },
    ],
  };
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
