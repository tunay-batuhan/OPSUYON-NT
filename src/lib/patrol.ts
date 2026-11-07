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
};
export type DailyReport = {
  project: { id: string; name: string; organization: string | null };
  date: string; // YYYY-MM-DD
  points: PatrolPoint[];
  scans: PatrolScanRow[];
};

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
export function locationLabel(s: Pick<PatrolScanRow, "lat" | "distance_m">): { text: string; far: boolean } {
  if (s.lat == null) return { text: "—", far: false };
  if (s.distance_m == null) return { text: "Konum var", far: false };
  if (s.distance_m > PATROL_FAR_M) return { text: `${s.distance_m} m uzakta`, far: true };
  return { text: `${s.distance_m} m`, far: false };
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
