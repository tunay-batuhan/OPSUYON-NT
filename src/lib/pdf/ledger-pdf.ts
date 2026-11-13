import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { formatDate, formatMoney } from "@/lib/format";
import { LEDGER_KIND_LABELS } from "@/lib/schemas-ledger";
import type { LedgerStatement } from "@/lib/ledger-statement";

// Devriye raporuyla aynı görünüm: lacivert başlık bandı, künye, özet kutuları, sayfa kıran tablo, alt bilgi.
const W = 595.28;
const H = 841.89;
const M = 40;
const NAVY = rgb(0.039, 0.165, 0.388);
const BRAND = rgb(0.122, 0.435, 0.898);
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.4, 0.45, 0.53);
const LINE = rgb(0.84, 0.87, 0.92);
const SOFT = rgb(0.95, 0.96, 0.98);
const OK = rgb(0.07, 0.55, 0.3);
const BAD = rgb(0.8, 0.15, 0.15);

type Col = { label: string; width: number; align?: "left" | "right" | "center"; wrap?: boolean };

const fmtNow = () =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

/** Bakiyenin anlamı: pozitif → firma borçlu, negatif → firma alacaklı. */
const balanceHint = (b: number) => (b > 0 ? "Firma borçlu" : b < 0 ? "Firma alacaklı" : "Hesap kapalı");
const balanceColor = (b: number) => (b > 0 ? BAD : b < 0 ? OK : INK);

/**
 * Cari hesap ekstresi (PDF): firma ve dönem, devir bakiyesi, dönemin hareketleri ve yürüyen bakiye,
 * dönem toplamları (fatura, tahsilat) ve dönem sonu bakiyesi. Türkçe karakterler için Roboto gömülür.
 */
export async function buildLedgerStatementPdf(s: LedgerStatement): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Cari Hesap Ekstresi - ${s.organization.name} - ${s.start} - ${s.end}`);
  doc.setProducer("OPSÜYON");
  const regular = await doc.embedFont(Buffer.from(ROBOTO_REGULAR_B64, "base64"), { subset: true });
  const bold = await doc.embedFont(Buffer.from(ROBOTO_MEDIUM_B64, "base64"), { subset: true });

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const fit = (text: string, max: number, size: number, font: PDFFont) => {
    if (font.widthOfTextAtSize(text, size) <= max) return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > max) t = t.slice(0, -1);
    return t + "…";
  };
  const wrap = (text: string, max: number, size: number, font: PDFFont) => {
    const lines: string[] = [];
    let cur = "";
    for (const w of text.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && font.widthOfTextAtSize(next, size) > max) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return (lines.length ? lines : [""]).map((l) => fit(l, max, size, font));
  };
  const text = (str: string, x: number, yy: number, size = 9, font = regular, color = INK) => page.drawText(str, { x, y: yy, size, font, color });

  /* ---- başlık bandı ---- */
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY });
  text("CARİ HESAP EKSTRESİ", M, H - 40, 20, bold, rgb(1, 1, 1));
  text(fit(s.organization.name, W - 2 * M - 100, 10.5, regular), M, H - 60, 10.5, regular, rgb(0.78, 0.85, 0.97));
  const brand = "OPSÜYON";
  text(brand, W - M - bold.widthOfTextAtSize(brand, 13), H - 40, 13, bold, rgb(1, 1, 1));
  y = H - 78 - 26;

  /* ---- künye ---- */
  const info: [string, string][] = [
    ["Firma", s.organization.name],
    ["Dönem", `${formatDate(s.start)} – ${formatDate(s.end)}`],
    ...(s.kind ? [["Tür", `Yalnızca ${s.kind === "fatura" ? "faturalar" : "tahsilatlar"} listelenmiştir`] as [string, string]] : []),
    ["Rapor oluşturma", fmtNow()],
  ];
  for (const [k, v] of info) {
    text(k, M, y, 9, regular, MUTED);
    text(fit(v, W - 2 * M - 110, 10, bold), M + 110, y, 10, bold);
    y -= 16;
  }
  y -= 6;

  /* ---- özet kutuları ---- */
  const boxes: [string, string, RGB][] = [
    ["Devir bakiyesi", formatMoney(s.opening), balanceColor(s.opening)],
    ["Dönem faturaları", formatMoney(s.invoiced), BRAND],
    ["Dönem tahsilatları", formatMoney(s.collected), OK],
    [`Dönem sonu · ${balanceHint(s.closing)}`, formatMoney(s.closing), balanceColor(s.closing)],
  ];
  {
    const gap = 10;
    const bw = (W - 2 * M - gap * (boxes.length - 1)) / boxes.length;
    boxes.forEach(([label, value, color], i) => {
      const x = M + i * (bw + gap);
      page.drawRectangle({ x, y: y - 46, width: bw, height: 46, color: SOFT, borderColor: LINE, borderWidth: 0.7 });
      text(fit(value, bw - 16, 14, bold), x + 10, y - 23, 14, bold, color);
      text(fit(label, bw - 16, 7.5, regular), x + 10, y - 38, 7.5, regular, MUTED);
    });
    y -= 46 + 22;
  }

  /* ---- hareketler tablosu ---- */
  const cols: Col[] = [
    // toplam 515 (sayfa genişliği − kenar boşlukları); açıklama alt satıra iner
    { label: "Tarih", width: 60, align: "center" },
    { label: "Saat", width: 38, align: "center" },
    { label: "Tür", width: 48 },
    { label: "Açıklama", width: 138, wrap: true },
    { label: "Fatura (borç)", width: 77, align: "right" },
    { label: "Tahsilat (alacak)", width: 77, align: "right" },
    { label: "Bakiye", width: 77, align: "right" },
  ];
  text("Hareketler", M, y, 11.5, bold, NAVY);
  y -= 10;
  const drawHead = () => {
    page.drawRectangle({ x: M, y: y - 20, width: W - 2 * M, height: 20, color: SOFT });
    let cx = M;
    for (const c of cols) {
      const label = fit(c.label, c.width - 12, 8, bold);
      const lw = bold.widthOfTextAtSize(label, 8);
      const lx = c.align === "right" ? cx + c.width - 6 - lw : c.align === "center" ? cx + (c.width - lw) / 2 : cx + 6;
      text(label, lx, y - 13.5, 8, bold, MUTED);
      cx += c.width;
    }
    y -= 20;
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const LH = 11;
  /** Sütun numarasına göre hücre renkleri ({ 6: BAD } → yalnızca Bakiye kırmızı). */
  const at = (m: Record<number, RGB>) => cols.map((_, i) => m[i]);
  /** Satır: `strong` → kalın (devir / dönem sonu), `fill` → zemin rengi. */
  const row = (cells: string[], colors: (RGB | undefined)[] = [], strong = false, fill?: RGB) => {
    const font = strong ? bold : regular;
    const lines = cols.map((c, ci) => (c.wrap ? wrap(cells[ci] ?? "", c.width - 12, 9, font) : [fit(cells[ci] ?? "", c.width - 12, 9, font)]));
    const rowH = 18 + (Math.max(...lines.map((l) => l.length)) - 1) * LH;
    if (y - rowH < M + 24) {
      newPage();
      drawHead();
    }
    if (fill) page.drawRectangle({ x: M, y: y - rowH, width: W - 2 * M, height: rowH, color: fill });
    let cx = M;
    cols.forEach((c, ci) => {
      lines[ci].forEach((val, li) => {
        const vw = font.widthOfTextAtSize(val, 9);
        const vx = c.align === "right" ? cx + c.width - 6 - vw : c.align === "center" ? cx + (c.width - vw) / 2 : cx + 6;
        text(val, vx, y - 12.5 - li * LH, 9, font, colors[ci] ?? INK);
      });
      cx += c.width;
    });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.5, color: LINE });
    y -= rowH;
  };

  drawHead();
  row([formatDate(s.start), "", "", "Devir bakiyesi", "", "", formatMoney(s.opening)], at({ 0: MUTED, 6: balanceColor(s.opening) }), true, SOFT);
  if (s.rows.length === 0) {
    row(["", "", "", s.kind ? "Bu dönemde bu türde hareket yok" : "Bu dönemde hareket yok", "", "", ""], at({ 3: MUTED }));
  }
  for (const r of s.rows) {
    const inv = r.kind === "fatura";
    row(
      [
        formatDate(r.entry_date),
        r.entry_time.slice(0, 5),
        LEDGER_KIND_LABELS[r.kind],
        r.description ?? "—",
        inv ? formatMoney(r.amount) : "",
        inv ? "" : formatMoney(r.amount),
        formatMoney(r.running_balance),
      ],
      at({ 2: inv ? BRAND : OK, 3: r.description ? INK : MUTED, 5: OK, 6: balanceColor(r.running_balance) }),
    );
  }
  row(
    ["", "", "", "Dönem toplamı", formatMoney(s.invoiced), formatMoney(s.collected), ""],
    at({ 4: BRAND, 5: OK }),
    true,
  );
  row([formatDate(s.end), "", "", `Dönem sonu bakiyesi · ${balanceHint(s.closing)}`, "", "", formatMoney(s.closing)], at({ 0: MUTED, 6: balanceColor(s.closing) }), true, SOFT);
  y -= 14;

  /* ---- açıklama ---- */
  const notes = [
    "Bakiye = faturalar − tahsilatlar. Pozitif bakiye firmanın borcunu, negatif bakiye fazla tahsilatı (firmanın alacağını) gösterir.",
    "Bakiye sütunu, o hareketten sonraki firma bakiyesidir; tüm hareketler kronolojik sırayla hesaplanır.",
    ...(s.kind ? ["Tür süzgeci yalnızca listeyi daraltır; devir, dönem toplamları ve bakiyeler tüm hareketlere göre hesaplanmıştır."] : []),
  ];
  for (const n of notes) {
    for (const line of wrap(n, W - 2 * M - 12, 8.5, regular)) {
      if (y - 12 < M + 24) newPage();
      text(line, M + 6, y, 8.5, regular, MUTED);
      y -= 12;
    }
  }

  /* ---- alt bilgi ---- */
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M, y: M + 6 }, end: { x: W - M, y: M + 6 }, thickness: 0.5, color: LINE });
    pg.drawText("Bu ekstre OPSÜYON tarafından cari hesap kayıtlarından otomatik oluşturulmuştur.", { x: M, y: M - 6, size: 7.5, font: regular, color: MUTED });
    const label = `Sayfa ${i + 1} / ${pages.length}`;
    pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: M - 6, size: 7.5, font: regular, color: MUTED });
  });
  return doc.save();
}
