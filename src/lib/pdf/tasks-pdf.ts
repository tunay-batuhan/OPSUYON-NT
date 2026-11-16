import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ROBOTO_MEDIUM_B64, ROBOTO_REGULAR_B64 } from "@/lib/pdf/roboto";
import { formatDate } from "@/lib/format";
import { TASK_STATUS, taskStage, type TaskStage } from "@/lib/task-status";
import { EVENT_LABELS, FILE_STAGE_LABELS, type TaskDetail, type TaskEvent, type TaskFile } from "@/lib/task-detail";
import type { TaskCounts, TaskListRow } from "@/lib/task-data";

// Diğer raporlarla aynı görünüm: lacivert başlık bandı, künye, özet kutuları, sayfa kıran tablo, alt bilgi.
const NAVY = rgb(0.039, 0.165, 0.388);
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.4, 0.45, 0.53);
const LINE = rgb(0.84, 0.87, 0.92);
const SOFT = rgb(0.95, 0.96, 0.98);
const M = 36;

const STAGE_COLOR: Record<TaskStage, RGB> = {
  pending: rgb(0.78, 0.42, 0.04),
  issue: rgb(0.8, 0.15, 0.15),
  waiting_date: rgb(0.12, 0.36, 0.75),
  planned: rgb(0.12, 0.36, 0.75),
  finished: rgb(0.07, 0.55, 0.3),
  done: rgb(0.07, 0.55, 0.3),
  cancelled: MUTED,
};

const fmtNow = () =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
const fmtDT = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

type Col = { label: string; width: number; align?: "left" | "right" | "center"; wrap?: boolean };

/** Ortak çizim aracı: sayfa ekleme, sığdırma, satır kaydırma, tablo. */
async function makeDoc(title: string, landscape: boolean) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setProducer("OPSÜYON");
  const regular = await doc.embedFont(Buffer.from(ROBOTO_REGULAR_B64, "base64"), { subset: true });
  const bold = await doc.embedFont(Buffer.from(ROBOTO_MEDIUM_B64, "base64"), { subset: true });
  const W = landscape ? 841.89 : 595.28;
  const H = landscape ? 595.28 : 841.89;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const fit = (text: string, max: number, size: number, font: PDFFont) => {
    if (font.widthOfTextAtSize(text, size) <= max) return text;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > max) t = t.slice(0, -1);
    return t + "…";
  };
  const wrap = (text: string, max: number, size: number, font: PDFFont) => {
    const out: string[] = [];
    for (const para of text.split(/\n/)) {
      let cur = "";
      for (const w of para.split(/\s+/)) {
        const next = cur ? `${cur} ${w}` : w;
        if (cur && font.widthOfTextAtSize(next, size) > max) {
          out.push(cur);
          cur = w;
        } else cur = next;
      }
      out.push(cur);
    }
    return out.map((l) => fit(l, max, size, font));
  };
  const text = (s: string, x: number, yy: number, size = 9, font = regular, color = INK) => page.drawText(s, { x, y: yy, size, font, color });
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const ensure = (h: number) => {
    if (y - h < M + 24) newPage();
  };

  const band = (heading: string, sub: string) => {
    page.drawRectangle({ x: 0, y: H - 74, width: W, height: 74, color: NAVY });
    text(heading, M, H - 38, 19, bold, rgb(1, 1, 1));
    text(fit(sub, W - 2 * M - 110, 10, regular), M, H - 57, 10, regular, rgb(0.78, 0.85, 0.97));
    const brand = "OPSÜYON";
    text(brand, W - M - bold.widthOfTextAtSize(brand, 13), H - 38, 13, bold, rgb(1, 1, 1));
    y = H - 74 - 24;
  };

  const info = (rows: [string, string][], labelW = 105) => {
    for (const [k, v] of rows) {
      const lines = wrap(v, W - 2 * M - labelW, 10, bold);
      ensure(lines.length * 13 + 4);
      text(k, M, y, 9, regular, MUTED);
      lines.forEach((l, i) => text(l, M + labelW, y - i * 13, 10, bold));
      y -= lines.length * 13 + 4;
    }
    y -= 4;
  };

  const boxes = (items: [string, string, RGB][]) => {
    const gap = 10;
    const bw = (W - 2 * M - gap * (items.length - 1)) / items.length;
    ensure(52);
    items.forEach(([label, value, color], i) => {
      const x = M + i * (bw + gap);
      page.drawRectangle({ x, y: y - 44, width: bw, height: 44, color: SOFT, borderColor: LINE, borderWidth: 0.7 });
      text(fit(value, bw - 16, 15, bold), x + 10, y - 22, 15, bold, color);
      text(fit(label, bw - 16, 7.5, regular), x + 10, y - 36, 7.5, regular, MUTED);
    });
    y -= 44 + 18;
  };

  const heading = (s: string) => {
    ensure(30);
    text(s, M, y, 11.5, bold, NAVY);
    y -= 12;
  };

  const table = (cols: Col[], rows: { cells: string[]; colors?: (RGB | undefined)[] }[]) => {
    const LH = 11;
    const drawHead = () => {
      page.drawRectangle({ x: M, y: y - 20, width: W - 2 * M, height: 20, color: SOFT });
      let cx = M;
      for (const c of cols) {
        const label = fit(c.label, c.width - 10, 8, bold);
        const lw = bold.widthOfTextAtSize(label, 8);
        const lx = c.align === "right" ? cx + c.width - 5 - lw : c.align === "center" ? cx + (c.width - lw) / 2 : cx + 5;
        text(label, lx, y - 13.5, 8, bold, MUTED);
        cx += c.width;
      }
      y -= 20;
    };
    ensure(40);
    drawHead();
    for (const r of rows) {
      const lines = cols.map((c, ci) => (c.wrap ? wrap(r.cells[ci] ?? "", c.width - 10, 8.5, regular) : [fit(r.cells[ci] ?? "", c.width - 10, 8.5, regular)]));
      const rowH = 16 + (Math.max(...lines.map((l) => l.length)) - 1) * LH;
      if (y - rowH < M + 24) {
        newPage();
        drawHead();
      }
      let cx = M;
      cols.forEach((c, ci) => {
        lines[ci].forEach((val, li) => {
          const vw = regular.widthOfTextAtSize(val, 8.5);
          const vx = c.align === "right" ? cx + c.width - 5 - vw : c.align === "center" ? cx + (c.width - vw) / 2 : cx + 5;
          text(val, vx, y - 11.5 - li * LH, 8.5, regular, r.colors?.[ci] ?? INK);
        });
        cx += c.width;
      });
      page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.5, color: LINE });
      y -= rowH;
    }
    y -= 14;
  };

  const paragraph = (s: string, color = INK) => {
    for (const line of wrap(s, W - 2 * M, 9.5, regular)) {
      ensure(14);
      text(line, M, y, 9.5, regular, color);
      y -= 13;
    }
    y -= 6;
  };

  const images = async (list: { bytes: Uint8Array; png: boolean; caption: string }[]) => {
    const cols = 3;
    const gap = 10;
    const cw = (W - 2 * M - gap * (cols - 1)) / cols;
    const ch = cw * 0.8;
    let i = 0;
    for (const im of list) {
      let img: PDFImage;
      try {
        img = im.png ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
      } catch {
        continue;
      }
      if (i % cols === 0) ensure(ch + 22);
      const x = M + (i % cols) * (cw + gap);
      const s = Math.min(cw / img.width, ch / img.height);
      const w = img.width * s;
      const h = img.height * s;
      page.drawRectangle({ x, y: y - ch, width: cw, height: ch, color: SOFT });
      page.drawImage(img, { x: x + (cw - w) / 2, y: y - ch + (ch - h) / 2, width: w, height: h });
      text(fit(im.caption, cw, 7.5, regular), x, y - ch - 10, 7.5, regular, MUTED);
      i++;
      if (i % cols === 0) y -= ch + 22;
    }
    if (i % cols !== 0) y -= ch + 22;
  };

  const finish = (footer: string) => {
    const pages = doc.getPages();
    pages.forEach((pg, i) => {
      pg.drawLine({ start: { x: M, y: M + 6 }, end: { x: W - M, y: M + 6 }, thickness: 0.5, color: LINE });
      pg.drawText(footer, { x: M, y: M - 6, size: 7.5, font: regular, color: MUTED });
      const label = `Sayfa ${i + 1} / ${pages.length}`;
      pg.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 7.5), y: M - 6, size: 7.5, font: regular, color: MUTED });
    });
    return doc.save();
  };

  return { W, band, info, boxes, heading, table, paragraph, images, finish };
}

/** Süzülmüş görev listesi (A4 yatay): süzgeç künyesi, sayaçlar, tablo. */
export async function buildTaskReportPdf(input: { rows: TaskListRow[]; counts: TaskCounts; filters: [string, string][]; multiProject: boolean; truncated: boolean }) {
  const d = await makeDoc("İş Planlama Raporu", true);
  d.band("İŞ PLANLAMA RAPORU", `${input.rows.length} görev · ${fmtNow()}`);
  d.info([...input.filters, ["Rapor oluşturma", fmtNow()]]);
  d.boxes([
    ["Onay bekleyen", String(input.counts.pending), STAGE_COLOR.pending],
    ["Planlanan", String(input.counts.planned), STAGE_COLOR.planned],
    ["Tarih bekleyen", String(input.counts.waitingDate), STAGE_COLOR.waiting_date],
    ["Sorun bildirilen", String(input.counts.issue), STAGE_COLOR.issue],
    ["Tamamlanan", String(input.counts.done), STAGE_COLOR.done],
  ]);
  const cols: Col[] = input.multiProject
    ? [
        { label: "#", width: 26, align: "center" },
        { label: "Personel", width: 120, wrap: true },
        { label: "Görevi", width: 95, wrap: true },
        { label: "Görev başlığı", width: 180, wrap: true },
        { label: "Proje", width: 110, wrap: true },
        { label: "Tarih", width: 62, align: "center" },
        { label: "Saat", width: 40, align: "center" },
        { label: "Durum", width: 136.89 },
      ]
    : [
        { label: "#", width: 26, align: "center" },
        { label: "Personel", width: 140, wrap: true },
        { label: "Görevi", width: 110, wrap: true },
        { label: "Görev başlığı", width: 250, wrap: true },
        { label: "Tarih", width: 64, align: "center" },
        { label: "Saat", width: 42, align: "center" },
        { label: "Durum", width: 137.89 },
      ];
  d.heading("Görevler");
  d.table(
    cols,
    input.rows.map((t, i) => {
      const stage = taskStage(t);
      const title = [t.title, t.location].filter(Boolean).join(" · ") + (stage === "issue" && t.issue_note ? `\nSorun: ${t.issue_note}` : "");
      const cells = [
        String(i + 1),
        t.personnel?.full_name ?? "—",
        t.job ?? "—",
        title,
        ...(input.multiProject ? [t.projects?.name ?? "—"] : []),
        t.planned_date ? formatDate(t.planned_date) : "—",
        t.planned_time ? t.planned_time.slice(0, 5) : "—",
        TASK_STATUS[stage].label,
      ];
      const colors = cells.map((_, ci) => (ci === cells.length - 1 ? STAGE_COLOR[stage] : undefined));
      return { cells, colors };
    }),
  );
  if (input.truncated) d.paragraph("Not: Rapor en fazla 1000 görev içerir; daha fazlası için süzgeci daraltın.", MUTED);
  return d.finish("Bu rapor OPSÜYON İş Planlama kayıtlarından otomatik oluşturulmuştur.");
}

/** Tek görev formu (A4 dikey): bilgiler, açıklama, sorun / bitirdi notu, fotoğraflar, geçmiş. */
export async function buildTaskPdf(input: {
  task: TaskDetail;
  events: TaskEvent[];
  files: TaskFile[];
  images: { bytes: Uint8Array; png: boolean; caption: string }[];
}) {
  const t = input.task;
  const stage = taskStage(t);
  const d = await makeDoc(`Görev - ${t.title}`, false);
  d.band("GÖREV FORMU", t.title);
  d.boxes([
    ["Durum", TASK_STATUS[stage].label, STAGE_COLOR[stage]],
    ["Görev tarihi", t.planned_date ? formatDate(t.planned_date) : "Verilmedi", INK],
    ["Saat", t.planned_time ? t.planned_time.slice(0, 5) : "—", INK],
  ]);
  d.info([
    ["Personel", t.personnel?.full_name ?? "—"],
    ["Görevi", t.job ?? "—"],
    ["Görev başlığı", t.title],
    ["Proje", [t.projects?.name, t.projects?.organizations?.name].filter(Boolean).join(" · ") || "—"],
    ["Görev yeri", t.location ?? "—"],
    ["Atama", fmtDT(t.created_at)],
    ...(t.accepted_at ? ([["Personel kabulü", fmtDT(t.accepted_at)]] as [string, string][]) : []),
    ...(t.finished_by_personnel_at ? ([["Personel bitirdi", fmtDT(t.finished_by_personnel_at)]] as [string, string][]) : []),
    ...(t.completed_at ? ([["Tamamlandı", fmtDT(t.completed_at)]] as [string, string][]) : []),
  ]);
  d.heading("Görev açıklaması");
  d.paragraph(t.description || "—", t.description ? INK : MUTED);
  if (t.issue_note && (t.status === "issue" || input.events.some((e) => e.kind === "issue"))) {
    d.heading("Personelin bildirdiği sorun");
    d.paragraph(t.issue_note, STAGE_COLOR.issue);
  }
  if (t.finish_note) {
    d.heading("Personelin iş bitimi notu");
    d.paragraph(t.finish_note);
  }
  if (input.images.length) {
    d.heading("Fotoğraflar");
    await d.images(input.images);
  }
  const others = input.files.filter((f) => !input.images.some((im) => im.caption.startsWith(f.file_name)));
  if (others.length) {
    d.heading("Ekler");
    d.table(
      [
        { label: "Dosya", width: 330, wrap: true },
        { label: "Ne zaman", width: 100, align: "center" },
        { label: "Aşama", width: 93.28 },
      ],
      others.map((f) => ({ cells: [f.file_name, fmtDT(f.created_at), FILE_STAGE_LABELS[f.stage] ?? f.stage] })),
    );
  }
  d.heading("Geçmiş");
  d.table(
    [
      { label: "Tarih", width: 92, align: "center" },
      { label: "İşlem", width: 160, wrap: true },
      { label: "Kim", width: 110, wrap: true },
      { label: "Not", width: 161.28, wrap: true },
    ],
    input.events.map((e) => ({
      cells: [fmtDT(e.created_at), EVENT_LABELS[e.kind] ?? e.kind, e.actor_name ?? "—", e.note ?? ""],
      colors: [undefined, e.kind === "issue" ? STAGE_COLOR.issue : undefined],
    })),
  );
  return d.finish("Bu form OPSÜYON İş Planlama kayıtlarından otomatik oluşturulmuştur.");
}
