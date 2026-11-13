/** Türkiye 2016'dan beri sabit UTC+3 kullanır (yaz saati uygulaması yok). */
const TZ = "Europe/Istanbul";

export type PatrolPoint = { id: string; name: string; code: string; sort_order: number; is_active: boolean };
export type PatrolScanRow = {
  id: string;
  point_id: string;
  scanned_at: string;
  by: string;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  /** telefonun bildirdiği isabet (metre); konum yoksa boş */
  accuracy_m: number | null;
};
export type DailyReport = {
  project: { id: string; name: string; organization: string | null };
  date: string; // YYYY-MM-DD
  points: PatrolPoint[];
  scans: PatrolScanRow[];
};
/** Birden çok günü kapsayan (haftalık / aylık) rapor: aralıktaki her gün, okutma olmasa da listelenir. */
export type RangeReport = {
  project: { id: string; name: string; organization: string | null };
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (dahil)
  points: PatrolPoint[];
  days: { date: string; scans: PatrolScanRow[] }[];
};

/** start..end (dahil) arasındaki günler, YYYY-AA-GG; en fazla 400 gün. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${start}T12:00:00+03:00`);
  const last = Date.parse(`${end}T12:00:00+03:00`);
  while (t <= last && out.length < 400) {
    out.push(istanbulDay(new Date(t)));
    t += 86400000;
  }
  return out;
}

export const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Bir günün (Türkiye saatiyle) başlangıç ve bitişi: [from, to) */
export function dayRange(date: string): { from: string; to: string } {
  const next = new Date(Date.parse(`${date}T00:00:00+03:00`) + 86400000);
  return { from: `${date}T00:00:00+03:00`, to: next.toISOString() };
}

/** Ayın tamamı (gün seçilmediğinde) */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return { from: `${year}-${pad(month)}-01T00:00:00+03:00`, to: `${ny}-${pad(nm)}-01T00:00:00+03:00` };
}

/** Bir zaman damgasının Türkiye saatindeki günü (YYYY-MM-DD) */
export function istanbulDay(ts: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

export const fmtClock = (ts: string | Date, seconds = true) =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hour12: false }).format(new Date(ts));

export const fmtDay = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${date}T12:00:00+03:00`));

export const fmtDayLong = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(new Date(`${date}T12:00:00+03:00`));

export const fmtDateTime = (ts: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

/** Barkod/QR içeriği: karışabilecek harfler (0/O, 1/I) olmadan, okunaklı ve tahmin edilmesi zor. */
export function newPointCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 harf: 256 % 32 = 0, dağılım dengeli
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
  return `DVR-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Okutma, noktanın bilinen konumundan bu kadar uzaksa raporda uyarıyla işaretlenir (GPS kapalı alanda sapabilir). */
export const PATROL_FAR_M = 150;

/** Okutma kayıtları bu kadar gün saklanır (veritabanı her gece eskileri siler: purge_old_patrol_data). */
export const PATROL_KEEP_DAYS = 31;

export const mapsUrl = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

/** Konum özeti: "✓ 12 m", "⚠ 320 m uzakta", "Konum var" (noktanın konumu henüz bilinmiyor) ya da "—". */
/**
 * Konum etiketi. Telefon konumu her zaman bir isabet payıyla gelir (açık alanda 5–20 m, bina içinde 50–100 m olabilir);
 * "uzak" uyarısı ancak isabet payı düşüldükten sonra bile PATROL_FAR_M'yi aşıyorsa verilir. `hint` isabet payını açıklar.
 */
export function locationLabel(s: Pick<PatrolScanRow, "lat" | "distance_m" | "accuracy_m">): { text: string; far: boolean; hint?: string } {
  if (s.lat == null) return { text: "—", far: false, hint: "Telefon konum vermedi" };
  const hint = s.accuracy_m != null ? `Telefonun isabet payı ±${s.accuracy_m} m` : undefined;
  if (s.distance_m == null) return { text: "Konum var", far: false, hint };
  const far = s.distance_m - (s.accuracy_m ?? 0) > PATROL_FAR_M;
  return { text: far ? `${s.distance_m} m uzakta` : `${s.distance_m} m`, far, hint };
}

/** QR etiketinin içeriği: sitedeki herkese açık okutma sayfası. */
export const patrolScanUrl = (origin: string, code: string) => `${origin.replace(/\/$/, "")}/d/${code}`;

/** 4 haneli proje PIN'i; kolay tahmin edilenler (1111, 1234, 9876…) üretilmez. */
export function newPatrolPin(): string {
  const weak = (p: string) => /^(\d)\1{3}$/.test(p) || "0123456789".includes(p) || "9876543210".includes(p);
  for (;;) {
    const n = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
    const pin = String(n).padStart(4, "0");
    if (!weak(pin)) return pin;
  }
}

export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");

/* ---------- devriye turu (rapor) ---------- */

export type TourEndKind = "bitti" | "zaman_asimi" | "yeni_tur";
/** patrol_tours satırı (token_hash hariç). Açık turda `missed` boştur; atlananlar canlı hesaplanır. */
export type PatrolTour = {
  id: string;
  project_id: string;
  personnel_id: string | null;
  person_name: string;
  started_at: string;
  last_scan_at: string;
  ended_at: string | null;
  end_kind: TourEndKind | null;
  points_total: number;
  points_done: number;
  missed: string[];
};
export const TOUR_COLUMNS = "id, project_id, personnel_id, person_name, started_at, last_scan_at, ended_at, end_kind, points_total, points_done, missed";

export type TourStatus = "tamam" | "eksik" | "zaman_asimi" | "yeni_tur" | "devam";
export const TOUR_STATUS: Record<TourStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "brand" }> = {
  tamam: { label: "Tamamlandı", tone: "success" },
  eksik: { label: "Eksik", tone: "warning" },
  zaman_asimi: { label: "Zaman aşımı", tone: "danger" },
  yeni_tur: { label: "Yeni turla kapandı", tone: "neutral" },
  devam: { label: "Devam ediyor", tone: "brand" },
};
export const isTourStatus = (v: unknown): v is TourStatus => typeof v === "string" && Object.hasOwn(TOUR_STATUS, v);

/** Turun durumu: açık → devam; görevli bitirdiyse atlanan yoksa tamam, varsa eksik; diğerleri kapanış türü. */
export function tourStatus(t: Pick<PatrolTour, "end_kind" | "missed">): TourStatus {
  if (!t.end_kind) return "devam";
  if (t.end_kind === "bitti") return (t.missed?.length ?? 0) > 0 ? "eksik" : "tamam";
  return t.end_kind;
}

/**
 * Sürenin bittiği an: görevli bitirdiyse bitiş; zaman aşımı / yeni turla kapananda son okutma
 * (kapanış anı son okutmadan 1 saat sonradır, süreyi şişirmesin); açık turda şimdi.
 */
export const tourEndAt = (t: Pick<PatrolTour, "end_kind" | "ended_at" | "last_scan_at">, now: Date = new Date()): string =>
  t.end_kind === "bitti" && t.ended_at ? t.ended_at : t.end_kind ? t.last_scan_at : now.toISOString();

/** "42 dk", "1 sa 05 dk", "1 dk'dan az" */
export function fmtDuration(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return "1 dk'dan az";
  if (min < 60) return `${min} dk`;
  return `${Math.floor(min / 60)} sa ${String(min % 60).padStart(2, "0")} dk`;
}
export const tourDuration = (t: Pick<PatrolTour, "started_at" | "end_kind" | "ended_at" | "last_scan_at">, now: Date = new Date()) =>
  fmtDuration(Date.parse(tourEndAt(t, now)) - Date.parse(t.started_at));

/** Tur raporu (PDF): her tur okutmalarıyla; tura bağlı olmayan eski okutmalar ayrıca. */
export type TourReportTour = PatrolTour & {
  status: TourStatus;
  /** okutulan / toplam nokta ve atlananlar (açık turda canlı) */
  done: number;
  total: number;
  missing: string[];
  scans: (PatrolScanRow & { mark?: "start" | "end" })[];
};
/** Turda okutulan noktaların adları: okutma sırasıyla, her nokta bir kez (başlat/bitir okutmaları hariç). */
export function scannedPointNames(t: Pick<TourReportTour, "scans">, nameOf: (pointId: string) => string | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of t.scans) {
    if (s.mark || seen.has(s.point_id)) continue;
    seen.add(s.point_id);
    out.push(nameOf(s.point_id) ?? "—");
  }
  return out;
}

export type TourReport = {
  project: { id: string; name: string; organization: string | null };
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (dahil)
  filters: { status: TourStatus | null; person: string | null };
  /** aktif kontrol noktaları (başlat/bitir etiketi hariç) */
  points: PatrolPoint[];
  tours: TourReportTour[];
  /** tura bağlı olmayan (eski sistem) okutmalar */
  legacy: PatrolScanRow[];
  /** nokta id → ad (başlat/bitir etiketi ve pasif noktalar dahil) */
  pointNames: Record<string, string>;
};

/**
 * Nokta bazında tur özeti: her kontrol noktası kaç turda okutuldu, kaç turda atlandı.
 * Atlanma, kapanmış turun dondurulmuş atlanan listesinden (ada göre) sayılır; açık turlar henüz atlamış sayılmaz.
 */
export function checkpointStats(
  points: { id: string; name: string }[],
  tours: { closed: boolean; missed: string[]; scanned: Set<string> }[],
): { id: string; name: string; scanned: number; missed: number }[] {
  return points.map((p) => ({
    id: p.id,
    name: p.name,
    scanned: tours.filter((t) => t.scanned.has(p.id)).length,
    missed: tours.filter((t) => t.closed && !t.scanned.has(p.id) && t.missed.includes(p.name)).length,
  }));
}
