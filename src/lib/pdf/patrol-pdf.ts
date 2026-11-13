import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import {
  TOUR_STATUS, checkpointStats, fmtClock, fmtDateTime, fmtDay, fmtDayLong, istanbulDay, locationLabel, scannedPointNames, tourDuration,
  type PatrolScanRow, type TourReport, type TourReportTour, type TourStatus,
} from "@/lib/patrol";

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
const WARN = rgb(0.75, 0.45, 0.05);
const BAD = rgb(0.8, 0.15, 0.15);

/** `wrap`: hücre sığmazsa kısaltılmaz, alt satıra iner (satır yüksekliği büyür). */
type Col = { label: string; width: number; align?: "left" | "right" | "center"; wrap?: boolean };
type Box = [label: string, value: string, color: RGB];

/** Raporun ortak iskeleti: başlık bandı, künye, özet kutuları, sayfa kıran tablo, tur başlığı, alt bilgi. */
async function createReportDoc(title: string, project: TourReport["project"]) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
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
  /** Metni verilen genişliğe sığacak satırlara böler (kelime kelime). */
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
    return lines.map((l) => fit(l, max, size, font));
  };
  /** Virgüllü listeyi satırlara böler: önce öğe aralarından (ad ortasından bölmemek için), sığmayan öğe kelimeden. */
  const wrapList = (list: string, max: number, size: number, font: PDFFont) => {
    const lines: string[] = [];
    let cur = "";
    const items = list.split(", ");
    items.forEach((item, i) => {
      const piece = i < items.length - 1 ? `${item},` : item;
      const next = cur ? `${cur} ${piece}` : piece;
      if (font.widthOfTextAtSize(next, size) <= max) cur = next;
      else {
        if (cur) lines.push(cur);
        const parts = wrap(piece, max, size, font);
        cur = parts.pop() ?? "";
        lines.push(...parts);
      }
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };
  const text = (s: string, x: number, yy: number, size = 9, font = regular, color = INK) => page.drawText(s, { x, y: yy, size, font, color });
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const ensure = (h: number) => {
    if (y - h < M + 24) newPage();
  };

  /* ---- başlık bandı ---- */
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: NAVY });
  text("DEVRİYE RAPORU", M, H - 40, 20, bold, rgb(1, 1, 1));
  text(fit(project.name, W - 2 * M - 100, 10.5, regular), M, H - 60, 10.5, regular, rgb(0.78, 0.85, 0.97));
  const brand = "OPSÜYON";
  text(brand, W - M - bold.widthOfTextAtSize(brand, 13), H - 40, 13, bold, rgb(1, 1, 1));
  y = H - 78 - 26;

  const info = (rows: [string, string][]) => {
    for (const [k, v] of rows) {
      text(k, M, y, 9, regular, MUTED);
      text(fit(v, W - 2 * M - 110, 10, bold), M + 110, y, 10, bold);
      y -= 16;
    }
    y -= 6;
  };

  const boxes = (items: Box[]) => {
    const gap = 10;
    const bw = (W - 2 * M - gap * (items.length - 1)) / items.length;
    items.forEach(([label, value, color], i) => {
      const x = M + i * (bw + gap);
      page.drawRectangle({ x, y: y - 46, width: bw, height: 46, color: SOFT, borderColor: LINE, borderWidth: 0.7 });
      text(value, x + 10, y - 24, 18, bold, color);
      text(fit(label, bw - 16, 8, regular), x + 10, y - 39, 8, regular, MUTED);
    });
    y -= 46 + 22;
  };

  /** Bölüm başlığı (lacivert). */
  const heading = (title: string) => {
    ensure(60);
    text(title, M, y, 11.5, bold, NAVY);
    y -= 18;
  };

  /** Sarılan paragraf. */
  const paragraph = (s: string, color = MUTED, size = 9) => {
    for (const line of wrap(s, W - 2 * M - 12, size, regular)) {
      ensure(14);
      text(line, M + 6, y, size, regular, color);
      y -= size + 4;
    }
    y -= 4;
  };

  /** Tablo; `title` boşsa başlık yazılmaz (tur bloğunun altındaki okutmalar). */
  const table = (title: string | null, cols: Col[], rows: string[][], rowColors?: (RGB | undefined)[][], empty = "Kayıt yok") => {
    ensure(title ? 60 : 44);
    if (title) {
      text(title, M, y, 11.5, bold, NAVY);
      y -= 10;
    }
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
    drawHead();
    if (rows.length === 0) {
      text(empty, M + 6, y - 14, 9, regular, MUTED);
      y -= 26;
      return;
    }
    const LH = 11; // sarılan hücrede satır aralığı
    rows.forEach((row, ri) => {
      const cells = cols.map((c, ci) => {
        const raw = row[ci] ?? "";
        return c.wrap ? wrapList(raw, c.width - 12, 9, regular) : [fit(raw, c.width - 12, 9, regular)];
      });
      const rowH = 18 + (Math.max(...cells.map((l) => l.length)) - 1) * LH;
      if (y - rowH < M + 24) {
        newPage();
        drawHead();
      }
      let cx = M;
      cols.forEach((c, ci) => {
        const color = rowColors?.[ri]?.[ci] ?? INK;
        cells[ci].forEach((val, li) => {
          const vw = regular.widthOfTextAtSize(val, 9);
          const vx = c.align === "right" ? cx + c.width - 6 - vw : c.align === "center" ? cx + (c.width - vw) / 2 : cx + 6;
          text(val, vx, y - 12.5 - li * LH, 9, regular, color);
        });
        cx += c.width;
      });
      page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.5, color: LINE });
      y -= rowH;
    });
    y -= 18;
  };

  /** Tur bloğunun başlık şeridi: solda başlık, sağda renkli durum; altında ayrıntı satırı. */
  const tourHeader = (title: string, status: string, statusColor: RGB, detail: string) => {
    ensure(22 + 16 + 20 + 3 * 18); // başlık + ayrıntı + tablo başı + birkaç satır aynı sayfada kalsın
    page.drawRectangle({ x: M, y: y - 22, width: W - 2 * M, height: 22, color: SOFT, borderColor: LINE, borderWidth: 0.7 });
    const sw = bold.widthOfTextAtSize(status, 9.5);
    text(fit(title, W - 2 * M - sw - 30, 10.5, bold), M + 8, y - 15, 10.5, bold, INK);
    text(status, W - M - 8 - sw, y - 15, 9.5, bold, statusColor);
    y -= 22 + 13;
    text(fit(detail, W - 2 * M - 12, 9, regular), M + 6, y, 9, regular, INK);
    y -= 12;
  };

  const gap = (h: number) => {
    y -= h;
  };

  const finish = async () => {
    const pages = doc.getPages();
    pages.forEach((pg, i) => {
      pg.drawLine({ start: { x: M, y: M + 6 }, end: { x: W - M, y: M + 6 }, thickness: 0.5, color: LINE });
      pg.drawText("Bu rapor OPSÜYON tarafından devriye tur ve okutma kayıtlarından otomatik oluşturulmuştur.", { x: M, y: M - 6, size: 7.5, font: regular, color: MUTED });
      const label = `Sayfa ${i + 1} / ${pages.length}`;
      pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: M - 6, size: 7.5, font: regular, color: MUTED });
    });
    return doc.save();
  };

  return { info, boxes, heading, paragraph, table, tourHeader, gap, finish };
}

const STATUS_COLOR: Record<TourStatus, RGB> = { tamam: OK, eksik: WARN, zaman_asimi: BAD, yeni_tur: MUTED, devam: BRAND };

/** Aralık tek günse yalnızca saat, değilse "GG.AA SS:DD". */
const when = (ts: string, oneDay: boolean, seconds = false) => (oneDay ? fmtClock(ts, seconds) : `${fmtDay(istanbulDay(ts)).slice(0, 5)} ${fmtClock(ts, seconds)}`);

/** Bitiş hücresi: görevli bitirdiyse / yeni turla kapandıysa saat, zaman aşımında son okutma, açıkta "—". */
const endText = (t: TourReportTour) => {
  if (t.status === "devam") return "—";
  if (t.status === "zaman_asimi") return `son okutma ${fmtClock(t.last_scan_at, false)}`;
  // gece yarısını geçen turda bitişin günü de yazılır
  return istanbulDay(t.ended_at!) === istanbulDay(t.started_at) ? fmtClock(t.ended_at!, false) : when(t.ended_at!, false);
};

/**
 * Tur tabanlı devriye raporu (günlük ya da tarih aralığı): üstte özet ve nokta bazında atlanma tablosu,
 * ardından turların listesi ve her turun okutmaları; tura bağlı olmayan eski okutmalar en sonda.
 * Müşteri bu PDF'i saklayarak 1 aylık saklama süresinden sonra da geçmişe bakabilir.
 */
export async function buildPatrolTourPdf(r: TourReport): Promise<Uint8Array> {
  const oneDay = r.start === r.end;
  const d = await createReportDoc(`Devriye Raporu - ${r.project.name} - ${oneDay ? r.start : `${r.start} - ${r.end}`}`, r.project);
  const dayCount = Math.round((Date.parse(r.end) - Date.parse(r.start)) / 86400000) + 1;
  const filterText = [r.filters.status && `Durum: ${TOUR_STATUS[r.filters.status].label}`, r.filters.person && `Personel: “${r.filters.person}”`].filter(Boolean).join(" · ");

  d.info([
    ["Firma", r.project.organization ?? "—"],
    ["Proje", r.project.name],
    oneDay ? ["Tarih", fmtDayLong(r.start)] : ["Tarih aralığı", `${fmtDay(r.start)} – ${fmtDay(r.end)} (${dayCount} gün)`],
    ...(filterText ? [["Filtre", filterText] as [string, string]] : []),
    ["Rapor oluşturma", fmtDateTime(new Date())],
  ]);

  /* ---- özet ---- */
  const count = (s: TourStatus) => r.tours.filter((t) => t.status === s).length;
  const missedTotal = r.tours.filter((t) => t.status !== "devam").reduce((a, t) => a + t.missing.length, 0);
  const late = count("zaman_asimi");
  const partial = count("eksik");
  d.boxes([
    ["Tur sayısı", String(r.tours.length), BRAND],
    ["Tamamlanan", String(count("tamam")), OK],
    ["Eksik", String(partial), partial ? WARN : INK],
    ["Zaman aşımı", String(late), late ? BAD : INK],
    ["Atlanan nokta", String(missedTotal), missedTotal ? BAD : INK],
  ]);

  /* ---- nokta durumu: hangi nokta kaç turda atlandı ---- */
  if (r.points.length > 0) {
    const stats = checkpointStats(
      r.points.filter((p) => p.is_active),
      r.tours.map((t) => ({ closed: t.status !== "devam", missed: t.missing, scanned: new Set(t.scans.map((s) => s.point_id)) })),
    );
    d.table(
      "Nokta durumu",
      [
        { label: "Nokta", width: 255 },
        { label: "Okutulan tur", width: 90, align: "right" },
        { label: "Atlanan tur", width: 80, align: "right" },
        { label: "Atlanma", width: 90, align: "center" },
      ],
      stats.map((p) => {
        const base = p.scanned + p.missed;
        return [p.name, String(p.scanned), String(p.missed), base ? `%${Math.round((p.missed / base) * 100)}` : "—"];
      }),
      stats.map((p) => [undefined, undefined, p.missed ? BAD : undefined, p.missed ? BAD : p.scanned ? OK : MUTED]),
    );
  }

  /* ---- tur listesi ---- */
  d.table(
    "Turlar",
    [
      // toplam 515 (sayfa genişliği - kenar boşlukları); "Nokta adı" kalan yeri alır ve alt satıra iner
      { label: "#", width: 20, align: "right" },
      { label: "Personel", width: 88, wrap: true },
      { label: "Başlangıç", width: oneDay ? 50 : 66, align: "center" },
      { label: "Bitiş", width: 62, align: "center", wrap: true },
      { label: "Süre", width: 60, align: "center" },
      { label: "Nokta", width: 38, align: "center" },
      { label: "Nokta adı", width: oneDay ? 127 : 111, wrap: true },
      { label: "Durum", width: 70, align: "center", wrap: true },
    ],
    r.tours.map((t, i) => [
      String(i + 1),
      t.person_name,
      when(t.started_at, oneDay),
      endText(t),
      tourDuration(t),
      `${t.done} / ${t.total}`,
      scannedPointNames(t, (id) => r.pointNames[id]).join(", ") || "—",
      TOUR_STATUS[t.status].label,
    ]),
    r.tours.map((t) => [undefined, undefined, undefined, t.status === "zaman_asimi" ? BAD : undefined, undefined, t.missing.length && t.status !== "devam" ? WARN : undefined, undefined, STATUS_COLOR[t.status]]),
    "Bu aralıkta devriye turu yok. Devriye, “Devriye başlat / bitir” QR'ı okutulunca başlar.",
  );

  /* ---- her tur ayrıntısıyla ---- */
  if (r.tours.length > 0) d.heading("Tur ayrıntıları");
  const name = (id: string) => r.pointNames[id] ?? "—";
  r.tours.forEach((t, i) => {
    const detail = [
      `Başlangıç ${when(t.started_at, oneDay, true)}`,
      t.status === "zaman_asimi" ? `Bitirilmedi (son okutma ${fmtClock(t.last_scan_at)})` : t.status === "devam" ? "Devam ediyor" : `Bitiş ${fmtClock(t.ended_at!)}`,
      `Süre ${tourDuration(t)}`,
      `Okutulan ${t.done} / ${t.total} nokta`,
    ].join("  ·  ");
    d.tourHeader(`${i + 1}. tur · ${t.person_name}`, TOUR_STATUS[t.status].label, STATUS_COLOR[t.status], detail);
    if (t.missing.length > 0) d.paragraph(`${t.status === "devam" ? "Henüz okutulmayan" : "Atlanan"}: ${t.missing.join(", ")}`, t.status === "devam" ? MUTED : BAD);
    else d.gap(2);
    d.table(
      null,
      [
        { label: "#", width: 30, align: "right" },
        { label: "Saat", width: 70, align: "center" },
        { label: "Nokta", width: 265 },
        { label: "Konum", width: 150, align: "center" },
      ],
      t.scans.map((s, j) => [
        String(j + 1),
        fmtClock(s.scanned_at),
        s.mark === "start" ? "Başlangıç (devriye başlatıldı)" : s.mark === "end" ? "Bitiş (devriye bitirildi)" : name(s.point_id),
        locationLabel(s).text,
      ]),
      t.scans.map((s) => [undefined, undefined, s.mark ? MUTED : undefined, locationLabel(s).far ? BAD : undefined]),
      "Okutma yok",
    );
  });

  /* ---- tura bağlı olmayan eski okutmalar ---- */
  if (r.legacy.length > 0) {
    const rows = (scans: PatrolScanRow[]) => scans.map((s, i) => [String(i + 1), when(s.scanned_at, oneDay, true), name(s.point_id), s.by, locationLabel(s).text]);
    d.table(
      "Tur dışı okutmalar (eski sistem)",
      [
        { label: "#", width: 30, align: "right" },
        { label: oneDay ? "Saat" : "Tarih ve saat", width: oneDay ? 70 : 100, align: "center" },
        { label: "Nokta", width: oneDay ? 175 : 160 },
        { label: "Okutan", width: oneDay ? 145 : 130 },
        { label: "Konum", width: 95, align: "center" },
      ],
      rows(r.legacy),
      r.legacy.map((s) => [undefined, undefined, undefined, undefined, locationLabel(s).far ? BAD : undefined]),
    );
  }

  return d.finish();
}
