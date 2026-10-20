/** Türkiye 2016'dan beri sabit UTC+3 kullanır (yaz saati uygulaması yok). */
const TZ = "Europe/Istanbul";

export type PatrolPoint = { id: string; name: string; code: string; sort_order: number; is_active: boolean };
export type PatrolScanRow = { id: string; point_id: string; scanned_at: string; scanned_by: string | null; by: string };
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

export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");
