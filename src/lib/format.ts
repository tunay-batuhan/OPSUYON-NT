const tr = "tr-TR";

export const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(tr, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(tr, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function formatMoney(value: number | string | null | undefined, currency = "TRY"): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(tr, { style: "currency", currency }).format(Number(value));
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(tr, { maximumFractionDigits: 2 }).format(Number(value));
}

export function formatPeriod(year: number | null, month: number | null): string {
  if (!year) return "—";
  return month ? `${MONTHS[month - 1]} ${year}` : String(year);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Turkish-aware slug for usernames and storage file names. */
export function slugify(input: string): string {
  return input
    .replaceAll("İ", "i")
    .replaceAll("I", "ı")
    .toLocaleLowerCase(tr)
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** YYYY-MM-DD for today + offset days (kept out of components: Date.now() is impure during render). */
export function isoDayFromNow(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

export function isoTimeFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}
