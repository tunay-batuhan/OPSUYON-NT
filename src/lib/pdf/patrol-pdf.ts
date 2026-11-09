import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { fmtClock, fmtDateTime, fmtDay, fmtDayLong, locationLabel, type DailyReport, type PatrolPoint, type PatrolScanRow, type RangeReport } from "@/lib/patrol";

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

type Col = { label: string; width: number; align?: "left" | "right" | "center" };
type Box = [label: string, value: string, color: RGB];

/** Günlük ve aralık raporlarının ortak iskeleti: başlık bandı, künye, özet kutuları, sayfa kıran tablo, alt bilgi. */
async function createReportDoc(title: string, project: DailyReport["project"]) {
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
      text(label, x + 10, y - 39, 8, regular, MUTED);
    });
    y -= 46 + 22;
  };

  const table = (title: string, cols: Col[], rows: string[][], rowColors?: (RGB | undefined)[][]) => {
    ensure(40);
    text(title, M, y, 11.5, bold, NAVY);
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
    drawHead();
    if (rows.length === 0) {
      text("Kayıt yok", M + 6, y - 14, 9, regular, MUTED);
      y -= 26;
      return;
    }
    rows.forEach((row, ri) => {
      if (y - 18 < M + 24) {
        newPage();
        drawHead();
      }
      let cx = M;
      cols.forEach((c, ci) => {
        const raw = row[ci] ?? "";
        const color = rowColors?.[ri]?.[ci] ?? INK;
        const val = fit(raw, c.width - 12, 9, regular);
        const vw = regular.widthOfTextAtSize(val, 9);
        const vx = c.align === "right" ? cx + c.width - 6 - vw : c.align === "center" ? cx + (c.width - vw) / 2 : cx + 6;
        text(val, vx, y - 12.5, 9, regular, color);
        cx += c.width;
      });
      page.drawLine({ start: { x: M, y: y - 18 }, end: { x: W - M, y: y - 18 }, thickness: 0.5, color: LINE });
      y -= 18;
    });
    y -= 18;
  };

  const finish = async () => {
    const pages = doc.getPages();
    pages.forEach((pg, i) => {
      pg.drawLine({ start: { x: M, y: M + 6 }, end: { x: W - M, y: M + 6 }, thickness: 0.5, color: LINE });
      pg.drawText("Bu rapor OPSÜYON tarafından devriye okutma kayıtlarından otomatik oluşturulmuştur.", { x: M, y: M - 6, size: 7.5, font: regular, color: MUTED });
      const label = `Sayfa ${i + 1} / ${pages.length}`;
      pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: M - 6, size: 7.5, font: regular, color: MUTED });
    });
    return doc.save();
  };

  return { info, boxes, table, finish };
}

const SCAN_COLS: Col[] = [
  { label: "#", width: 30, align: "right" },
  { label: "Saat", width: 65, align: "center" },
  { label: "Nokta", width: 175 },
  { label: "Okutan", width: 150 },
  { label: "Konum", width: 95, align: "center" },
];

const scanRows = (scans: PatrolScanRow[], pointName: Map<string, string>) => ({
  rows: scans.map((s, i) => [String(i + 1), fmtClock(s.scanned_at), pointName.get(s.point_id) ?? "—", s.by, locationLabel(s).text]),
  colors: scans.map((s) => [undefined, undefined, undefined, undefined, locationLabel(s).far ? BAD : undefined]),
});

const groupByPoint = (scans: PatrolScanRow[]) => {
  const byPoint = new Map<string, PatrolScanRow[]>();
  for (const s of scans) byPoint.set(s.point_id, [...(byPoint.get(s.point_id) ?? []), s]);
  return byPoint;
};

/** Günlük devriye raporunu (Türkçe karakter destekli) PDF olarak üretir. */
export async function buildPatrolReportPdf(r: DailyReport): Promise<Uint8Array> {
  const d = await createReportDoc(`Devriye Raporu - ${r.project.name} - ${r.date}`, r.project);

  d.info([
    ["Firma", r.project.organization ?? "—"],
    ["Proje", r.project.name],
    ["Tarih", fmtDayLong(r.date)],
    ["Rapor oluşturma", fmtDateTime(new Date())],
  ]);

  const scannedIds = new Set(r.scans.map((s) => s.point_id));
  const total = r.points.length;
  const done = r.points.filter((p) => scannedIds.has(p.id)).length;
  d.boxes([
    ["Toplam nokta", String(total), INK],
    ["Okutulan nokta", String(done), OK],
    ["Okutulmayan nokta", String(total - done), total - done > 0 ? BAD : INK],
    ["Toplam okutma", String(r.scans.length), BRAND],
  ]);

  const byPoint = groupByPoint(r.scans);
  d.table(
    "Nokta özeti",
    [
      { label: "Nokta", width: 215 },
      { label: "Okutma", width: 55, align: "right" },
      { label: "İlk okutma", width: 75, align: "center" },
      { label: "Son okutma", width: 75, align: "center" },
      { label: "Durum", width: 95, align: "center" },
    ],
    r.points.map((p) => {
      const list = byPoint.get(p.id) ?? [];
      return [p.name, String(list.length), list.length ? fmtClock(list[0].scanned_at, false) : "—", list.length ? fmtClock(list[list.length - 1].scanned_at, false) : "—", list.length ? "Okutuldu" : "Okutulmadı"];
    }),
    r.points.map((p) => [undefined, undefined, undefined, undefined, (byPoint.get(p.id) ?? []).length ? OK : BAD]),
  );

  const pointName = new Map(r.points.map((p) => [p.id, p.name]));
  const sr = scanRows(r.scans, pointName);
  d.table("Okutma kayıtları", SCAN_COLS, sr.rows, sr.colors);

  return d.finish();
}

/**
 * Tarih aralığı (haftalık / aylık) raporu: günlük özet tablosu, nokta bazında kaç günde okutulduğu
 * ve gün gün okutma kayıtları. Müşteri bu PDF'i saklayarak 1 aylık saklama süresinden sonra da geçmişe bakabilir.
 */
export async function buildPatrolRangePdf(r: RangeReport): Promise<Uint8Array> {
  const d = await createReportDoc(`Devriye Raporu - ${r.project.name} - ${r.start} - ${r.end}`, r.project);
  const pointName = new Map(r.points.map((p) => [p.id, p.name]));
  const total = r.points.length;

  d.info([
    ["Firma", r.project.organization ?? "—"],
    ["Proje", r.project.name],
    ["Tarih aralığı", `${fmtDay(r.start)} – ${fmtDay(r.end)} (${r.days.length} gün)`],
    ["Rapor oluşturma", fmtDateTime(new Date())],
  ]);

  const dayStats = r.days.map((day) => {
    const ids = new Set(day.scans.map((s) => s.point_id));
    const done = r.points.filter((p) => ids.has(p.id)).length;
    return { ...day, done, state: day.scans.length === 0 ? "none" : done < total ? "partial" : "full" } as const;
  });
  const withPatrol = dayStats.filter((x) => x.scans.length > 0).length;
  const fullDays = dayStats.filter((x) => x.state === "full").length;
  const allScans = r.days.flatMap((x) => x.scans);
  const coverage = total && r.days.length ? Math.round((dayStats.reduce((a, x) => a + x.done, 0) / (total * r.days.length)) * 100) : 0;
  d.boxes([
    ["Gün sayısı", String(r.days.length), INK],
    ["Devriye yapılan gün", String(withPatrol), withPatrol < r.days.length ? WARN : OK],
    ["Tüm noktalar okutulan gün", String(fullDays), fullDays < r.days.length ? WARN : OK],
    ["Toplam okutma", String(allScans.length), BRAND],
    ["Nokta kapsaması", `%${coverage}`, coverage >= 100 ? OK : coverage >= 70 ? WARN : BAD],
  ]);

  /* ---- günlük özet ---- */
  const stateLabel = { none: "Devriye yok", partial: "Eksik", full: "Tam" } as const;
  const stateColor = { none: BAD, partial: WARN, full: OK } as const;
  d.table(
    "Günlük özet",
    [
      { label: "Tarih", width: 150 },
      { label: "Okutulan nokta", width: 95, align: "center" },
      { label: "Okutma", width: 60, align: "right" },
      { label: "İlk", width: 65, align: "center" },
      { label: "Son", width: 65, align: "center" },
      { label: "Durum", width: 80, align: "center" },
    ],
    dayStats.map((x) => [
      fmtDayLong(x.date),
      `${x.done} / ${total}`,
      String(x.scans.length),
      x.scans.length ? fmtClock(x.scans[0].scanned_at, false) : "—",
      x.scans.length ? fmtClock(x.scans[x.scans.length - 1].scanned_at, false) : "—",
      stateLabel[x.state],
    ]),
    dayStats.map((x) => [undefined, undefined, undefined, undefined, undefined, stateColor[x.state]]),
  );

  /* ---- nokta özeti (aralık boyunca) ---- */
  const daysOf = new Map<string, Set<string>>();
  const countOf = new Map<string, number>();
  for (const day of r.days) {
    for (const s of day.scans) {
      countOf.set(s.point_id, (countOf.get(s.point_id) ?? 0) + 1);
      daysOf.set(s.point_id, (daysOf.get(s.point_id) ?? new Set()).add(day.date));
    }
  }
  const pointRow = (p: PatrolPoint) => {
    const days = daysOf.get(p.id)?.size ?? 0;
    const missed = r.days.length - days;
    return { days, missed, count: countOf.get(p.id) ?? 0 };
  };
  d.table(
    "Nokta özeti",
    [
      { label: "Nokta", width: 235 },
      { label: "Toplam okutma", width: 90, align: "right" },
      { label: "Okutulan gün", width: 95, align: "center" },
      { label: "Atlanan gün", width: 95, align: "center" },
    ],
    r.points.map((p) => {
      const x = pointRow(p);
      return [p.name, String(x.count), `${x.days} / ${r.days.length}`, String(x.missed)];
    }),
    r.points.map((p) => [undefined, undefined, undefined, pointRow(p).missed > 0 ? BAD : OK]),
  );

  /* ---- gün gün okutma kayıtları ---- */
  for (const day of r.days) {
    if (day.scans.length === 0) continue;
    const sr = scanRows(day.scans, pointName);
    d.table(`Okutma kayıtları — ${fmtDayLong(day.date)}`, SCAN_COLS, sr.rows, sr.colors);
  }

  return d.finish();
}
