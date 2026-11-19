import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { GROUP_LABEL, netColumn, type PayCol, type PayGroup } from "@/lib/payroll-engine";
import { cellFmt, periodLabel, tl, type PayrollLineView, type PayrollRunView } from "@/lib/payroll-shared";

// Diğer raporlarla aynı görünüm: lacivert başlık bandı, künye, özet kutuları, tablo, alt bilgi.
// Sütunlar dönemin şablonundan gelir (müşterinin Excel düzeni; merkez değiştirebilir).
const NAVY = rgb(0.039, 0.165, 0.388);
const BRAND = rgb(0.122, 0.435, 0.898);
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.4, 0.45, 0.53);
const LINE = rgb(0.84, 0.87, 0.92);
const SOFT = rgb(0.95, 0.96, 0.98);
const OK = rgb(0.07, 0.55, 0.3);
const BAD = rgb(0.8, 0.15, 0.15);
const WHITE = rgb(1, 1, 1);
const GROUP_FILL: Record<PayGroup, RGB> = { bilgi: SOFT, kazanc: rgb(0.9, 0.96, 0.92), kesinti: rgb(0.99, 0.91, 0.91), odeme: rgb(0.9, 0.93, 0.99) };

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
  let page: PDFPage = doc.addPage([W, H]);
  const text = (s: string, x: number, y: number, size = 9.5, font = regular, color: RGB = INK) => page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xr: number, y: number, size = 9.5, font = regular, color: RGB = INK) => text(s, xr - font.widthOfTextAtSize(s, size), y, size, font, color);
  const cols = run.columns;
  const val = (code: string) => l.values[code] ?? 0;

  // başlık bandı
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY });
  text("BORDRO PUSULASI", M, H - 40, 20, bold, WHITE);
  text(fit(`${period} · ${run.org || run.project}`, W - 2 * M - 100, 10.5, regular), M, H - 60, 10.5, regular, rgb(0.78, 0.85, 0.97));
  right("OPSUYON", W - M, H - 40, 13, bold, WHITE);
  let y = H - 78 - 26;
  const ensure = (h: number) => {
    if (y - h < M + 24) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };

  // künye (+ bilgi grubundaki sütunlar: net maaş, gün…)
  const info: [string, string][] = [
    ["Personel", l.full_name + (l.title ? ` · ${l.title}` : "")],
    ["Firma", run.org || "—"],
    ["Proje", run.project || "—"],
    ["Dönem", period],
    ["Durum", run.status === "approved" ? `Onaylandı · ${fmtDate(run.approvedAt)}` : "Taslak (henüz onaylanmadı)"],
    ...cols.filter((c) => c.group === "bilgi").map((c) => [c.label, c.kind === "text" ? (l.texts[c.code] || "—") : cellFmt(c, val(c.code))] as [string, string]),
  ];
  for (const [k, v] of info) {
    text(k, M, y, 9, regular, MUTED);
    text(fit(v, W - 2 * M - 110, 10, bold), M + 110, y, 10, bold, k === "Durum" && run.status !== "approved" ? BAD : INK);
    y -= 16;
  }
  y -= 8;

  // özet kutuları: net ödenen + ödeme grubunun diğer sütunları (en çok 3)
  const net = netColumn(cols);
  const pay = cols.filter((c) => c.group === "odeme" && c.kind !== "text" && c.code !== net?.code).slice(0, 3);
  const boxes: [string, string, RGB][] = [
    ...(net ? [[net.label, `${tl(val(net.code))} ₺`, val(net.code) < 0 ? BAD : NAVY] as [string, string, RGB]] : []),
    ...pay.map((c, i) => [c.label, `${tl(val(c.code))} ₺`, val(c.code) < 0 ? BAD : i === 0 ? BRAND : OK] as [string, string, RGB]),
  ];
  if (boxes.length) {
    const gap = 10;
    const bw = (W - 2 * M - gap * (boxes.length - 1)) / boxes.length;
    boxes.forEach(([label, value, color], i) => {
      const x = M + i * (bw + gap);
      page.drawRectangle({ x, y: y - 50, width: bw, height: 50, color: SOFT, borderColor: LINE, borderWidth: 0.7 });
      text(fit(value, bw - 16, 14, bold), x + 10, y - 25, 14, bold, color);
      text(fit(label, bw - 16, 8, regular), x + 10, y - 41, 8, regular, MUTED);
    });
    y -= 50 + 24;
  }

  // grup tabloları: [kalem, ayrıntı (formül / elle), tutar]; 0 olan ara kalemler gösterilmez
  const table = (group: PayGroup, color: RGB) => {
    const rows = cols.filter((c) => c.group === group && (c.kind === "text" ? Boolean(l.texts[c.code]) : val(c.code) !== 0 || /toplam/.test(c.code) || c.code === net?.code));
    if (!rows.length) return;
    ensure(60);
    text(GROUP_LABEL[group], M, y, 11.5, bold, NAVY);
    y -= 8;
    page.drawRectangle({ x: M, y: y - 20, width: W - 2 * M, height: 20, color: SOFT });
    text("Kalem", M + 8, y - 13.5, 8, bold, MUTED);
    text("Ayrıntı", M + 190, y - 13.5, 8, bold, MUTED);
    right("Tutar (₺)", W - M - 8, y - 13.5, 8, bold, MUTED);
    y -= 20;
    for (const c of rows) {
      ensure(19);
      const strong = /toplam/.test(c.code) || c.code === net?.code;
      const detail = c.kind === "text" ? (l.texts[c.code] ?? "") : l.overridden.includes(c.code) ? "Elle girildi" : c.kind === "formula" ? `= ${c.formula}` : "";
      if (strong) page.drawRectangle({ x: M, y: y - 19, width: W - 2 * M, height: 19, color: SOFT });
      text(fit(c.label, 176, 9.5, strong ? bold : regular), M + 8, y - 13, 9.5, strong ? bold : regular);
      text(fit(detail, 230, 8, regular), M + 190, y - 13, 8, regular, MUTED);
      if (c.kind !== "text") right(tl(val(c.code)), W - M - 8, y - 13, 9.5, strong ? bold : regular, strong ? color : INK);
      page.drawLine({ start: { x: M, y: y - 19 }, end: { x: W - M, y: y - 19 }, thickness: 0.5, color: LINE });
      y -= 19;
    }
    y -= 18;
  };
  table("kazanc", INK);
  table("kesinti", BAD);
  table("odeme", NAVY);

  // net
  if (net) {
    ensure(46);
    page.drawRectangle({ x: M, y: y - 30, width: W - 2 * M, height: 30, color: NAVY });
    text(net.label.toLocaleUpperCase("tr"), M + 10, y - 19.5, 11.5, bold, WHITE);
    right(`${tl(val(net.code))} ₺`, W - M - 10, y - 19.5, 13, bold, WHITE);
    y -= 30 + 16;
  }
  ensure(70);
  y -= 44;
  // imza
  page.drawLine({ start: { x: W - M - 180, y }, end: { x: W - M, y }, thickness: 0.7, color: MUTED });
  text("Personel imzası", W - M - 180, y - 12, 8.5, regular, MUTED);
  text(`Oluşturma: ${fmtNow()}`, M, y - 12, 8, regular, MUTED);

  footer(doc, regular, W, M);
  return doc.save();
}

/* ------------------------------------------------------------------ */
/* Toplu bordro (yatay; çok sütunlu şablonda A3)                       */
/* ------------------------------------------------------------------ */
export async function buildPayrollListPdf(run: PayrollRunView): Promise<Uint8Array> {
  const cols: PayCol[] = run.columns;
  const wide = cols.length > 16;
  const W = wide ? 1190.55 : 841.89; // A3 / A4 yatay
  const H = wide ? 841.89 : 595.28;
  const M = 24;
  const period = periodLabel(run.year, run.month);
  const { doc, regular, bold, fit } = await setup(`Maaş Bordrosu - ${run.org} - ${period}`);
  const FS = wide ? 7 : 6.5;
  const nameW = wide ? 104 : 84;
  const signW = wide ? 64 : 46;
  const cw = (W - 2 * M - nameW - signW) / Math.max(1, cols.length);
  const net = netColumn(cols);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, yy: number, size = FS, font = regular, color: RGB = INK) => page.drawText(s, { x, y: yy, size, font, color });

  const band = () => {
    page.drawRectangle({ x: 0, y: H - 56, width: W, height: 56, color: NAVY });
    text(fit(`${(run.org || run.project).toLocaleUpperCase("tr")} ${period.toLocaleUpperCase("tr")} MAAŞ BORDROSU`, W - 2 * M - 90, 15, bold), M, H - 30, 15, bold, WHITE);
    text(fit(`${run.project} · ${run.lines.length} personel · ${run.status === "approved" ? `Onaylandı ${fmtDate(run.approvedAt)}` : "TASLAK (onaylanmadı)"}`, W - 2 * M - 90, 8.5, regular), M, H - 46, 8.5, regular, rgb(0.78, 0.85, 0.97));
    const brand = "OPSUYON";
    text(brand, W - M - bold.widthOfTextAtSize(brand, 12), H - 30, 12, bold, WHITE);
    y = H - 56 - 14;
  };
  const head = () => {
    // grup şeridi
    let gx = M + nameW;
    for (let i = 0; i < cols.length; ) {
      let j = i;
      while (j < cols.length && cols[j].group === cols[i].group) j++;
      const w = (j - i) * cw;
      page.drawRectangle({ x: gx, y: y - 13, width: w, height: 13, color: GROUP_FILL[cols[i].group] });
      const g = fit(GROUP_LABEL[cols[i].group].toLocaleUpperCase("tr"), w - 4, FS, bold);
      text(g, gx + (w - bold.widthOfTextAtSize(g, FS)) / 2, y - 9.5, FS, bold, MUTED);
      gx += w;
      i = j;
    }
    y -= 13;
    page.drawRectangle({ x: M, y: y - 24, width: W - 2 * M, height: 24, color: SOFT });
    text("Adı soyadı", M + 3, y - 15, FS, bold, MUTED);
    let cx = M + nameW;
    for (const c of cols) {
      const words = c.label.split(" ");
      const lines = words.length > 1 && bold.widthOfTextAtSize(c.label, FS) > cw - 4 ? [words.slice(0, -1).join(" "), words.at(-1)!] : [c.label];
      lines.forEach((ln, i) => {
        const s = fit(ln, cw - 4, FS, bold);
        text(s, cx + cw - 3 - bold.widthOfTextAtSize(s, FS), y - (lines.length === 1 ? 15 : 10 + i * 8), FS, bold, MUTED);
      });
      cx += cw;
    }
    text("İmza", cx + 3, y - 15, FS, bold, MUTED);
    y -= 24;
  };
  const row = (name: string, cells: (string | null)[], strongRow = false, fill?: RGB, colors: (RGB | undefined)[] = []) => {
    const rh = wide ? 19 : 17;
    if (y - rh < M + 20) {
      page = doc.addPage([W, H]);
      band();
      head();
    }
    if (fill) page.drawRectangle({ x: M, y: y - rh, width: W - 2 * M, height: rh, color: fill });
    text(fit(name, nameW - 6, FS + 0.5, bold), M + 3, y - rh / 2 - 2.5, FS + 0.5, bold);
    let cx = M + nameW;
    cols.forEach((c, i) => {
      const font = strongRow || c.code === net?.code ? bold : regular;
      const s = fit(cells[i] ?? "", cw - 4, FS, font);
      text(s, cx + cw - 3 - font.widthOfTextAtSize(s, FS), y - rh / 2 - 2.5, FS, font, colors[i] ?? INK);
      cx += cw;
    });
    page.drawLine({ start: { x: M, y: y - rh }, end: { x: W - M, y: y - rh }, thickness: 0.4, color: LINE });
    y -= rh;
  };

  band();
  head();
  for (const l of run.lines) {
    row(
      l.full_name,
      cols.map((c) => (c.kind === "text" ? (l.texts[c.code] ?? "") : cellFmt(c, l.values[c.code] ?? 0) + (l.overridden.includes(c.code) ? "*" : ""))),
      false,
      undefined,
      cols.map((c) => (c.group === "odeme" && (l.values[c.code] ?? 0) < 0 ? BAD : undefined)),
    );
  }
  row(`TOPLAM (${run.lines.length})`, cols.map((c) => (c.total && c.kind !== "text" ? cellFmt(c, run.totals[c.code]) : "")), true, SOFT);

  y -= 14;
  if (y > M + 30) text(`Oluşturma: ${fmtNow()}   ·   * işaretli tutarlar elle girilmiştir (formül ezildi).`, M, y, 7, regular, MUTED);
  footer(doc, regular, W, M);
  return doc.save();
}
