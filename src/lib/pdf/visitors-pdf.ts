import { rgb, type RGB } from "pdf-lib";
import { makeDoc, type Col } from "@/lib/pdf/tasks-pdf";
import { dayTime, hhmm, logStatus, type VisitorLog } from "@/lib/visitor-shared";

const OK = rgb(0.07, 0.55, 0.3);
const BAD = rgb(0.8, 0.15, 0.15);
const WARN = rgb(0.78, 0.42, 0.04);
const BRAND = rgb(0.12, 0.36, 0.75);
const MUTED = rgb(0.4, 0.45, 0.53);

const toneColor = (t: string): RGB | undefined => (t === "success" ? OK : t === "danger" ? BAD : t === "warning" ? WARN : t === "brand" ? BRAND : t === "neutral" ? MUTED : undefined);

/**
 * Ziyaretçi ve kargo raporu (A4 yatay): süzgeç künyesi, sayılar, ziyaretçi tablosu (giriş, çıkış, ad soyad, telefon,
 * plaka, nereye, onay / durum, kaydeden) ve kargo tablosu (saat, firma, kime, paket, durum, teslim alan).
 */
export async function buildVisitorReportPdf(input: { rows: VisitorLog[]; filters: [string, string][]; multiProject: boolean; projectName: Map<string, string>; truncated: boolean }) {
  const d = await makeDoc("Ziyaretçi ve Kargo Raporu", true);
  const visitors = input.rows.filter((r) => r.kind === "ziyaretci");
  const cargo = input.rows.filter((r) => r.kind === "kargo");
  const period = input.filters.find(([k]) => k === "Tarih")?.[1] ?? "";
  d.band("ZİYARETÇİ VE KARGO RAPORU", period);
  d.info(input.filters.length ? input.filters : [["Süzgeç", "Yok"]]);
  d.boxes([
    ["Ziyaretçi", String(visitors.length), BRAND],
    ["İçeride (çıkışı yok)", String(visitors.filter((v) => v.approval === "onaylandi" && !v.exited_at).length), BRAND],
    ["Reddedilen", String(visitors.filter((v) => v.approval === "reddedildi").length), BAD],
    ["Kargo / teslimat", String(cargo.length), OK],
    ["Kulübede bekleyen kargo", String(cargo.filter((c) => !c.delivered_at).length), WARN],
  ]);
  const multiDay = new Set(input.rows.map((r) => dayTime(r.entered_at).slice(0, 10))).size > 1;
  const when = (iso: string) => (multiDay ? dayTime(iso) : hhmm(iso));
  const proj = (r: VisitorLog) => input.projectName.get(r.project_id) ?? "";

  d.heading(`Ziyaretçiler (${visitors.length})`);
  const vCols: Col[] = [
    { label: multiDay ? "Giriş" : "Giriş saati", width: multiDay ? 78 : 50, align: "center" },
    { label: "Çıkış", width: 40, align: "center" },
    { label: "Ad soyad", width: 112, wrap: true },
    { label: "Telefon", width: 78 },
    { label: "Plaka", width: 62 },
    { label: "Nereye (daire / firma)", width: input.multiProject ? 104 : 140, wrap: true },
    ...(input.multiProject ? [{ label: "Proje", width: 74, wrap: true } as Col] : []),
    { label: "Durum", width: 72 },
    { label: "Not", width: 0, wrap: true },
    { label: "Kaydeden", width: 80, wrap: true },
  ];
  // "Not" sütunu kalan genişliği alır
  const used = vCols.reduce((s, c) => s + c.width, 0);
  vCols.find((c) => c.label === "Not")!.width = Math.max(50, d.W - 72 - used);
  d.table(
    vCols,
    visitors.length
      ? visitors.map((v) => {
          const s = logStatus(v);
          const cells = [when(v.entered_at), hhmm(v.exited_at) || "—", v.full_name ?? "", v.phone ?? "—", v.plate ?? "—", v.destination, ...(input.multiProject ? [proj(v)] : []), s.label, v.note ?? "", v.recorder ?? "—"];
          const colors = cells.map((_, i) => (vCols[i].label === "Durum" ? toneColor(s.tone) : undefined));
          return { cells, colors };
        })
      : [{ cells: ["", "", "Bu dönemde ziyaretçi kaydı yok"] }],
  );

  d.heading(`Kargo ve teslimatlar (${cargo.length})`);
  const cCols: Col[] = [
    { label: multiDay ? "Geliş" : "Geliş saati", width: multiDay ? 78 : 56, align: "center" },
    { label: "Kargo firması", width: 100, wrap: true },
    { label: "Kime (daire / firma)", width: input.multiProject ? 130 : 160, wrap: true },
    ...(input.multiProject ? [{ label: "Proje", width: 80, wrap: true } as Col] : []),
    { label: "Paket", width: 38, align: "center" },
    { label: "Durum", width: 90 },
    { label: "Teslim", width: multiDay ? 78 : 46, align: "center" },
    { label: "Teslim alan", width: 0, wrap: true },
    { label: "Kaydeden", width: 80, wrap: true },
  ];
  const usedC = cCols.reduce((s, c) => s + c.width, 0);
  cCols.find((c) => c.label === "Teslim alan")!.width = Math.max(60, d.W - 72 - usedC);
  d.table(
    cCols,
    cargo.length
      ? cargo.map((c) => {
          const s = logStatus(c);
          const cells = [when(c.entered_at), c.courier ?? "", c.destination, ...(input.multiProject ? [proj(c)] : []), String(c.package_count), s.label, c.delivered_at ? when(c.delivered_at) : "—", c.delivered_to ?? "", c.recorder ?? "—"];
          const colors = cells.map((_, i) => (cCols[i].label === "Durum" ? toneColor(s.tone) : undefined));
          return { cells, colors };
        })
      : [{ cells: ["", "Bu dönemde kargo kaydı yok"] }],
  );
  if (input.truncated) d.paragraph("Not: rapor ilk 5000 kayıtla sınırlıdır; daha kısa bir tarih aralığı seçin.", MUTED);
  return d.finish("Bu rapor OPSUYON ziyaretçi ve kargo defteri kayıtlarından otomatik oluşturulmuştur.");
}
