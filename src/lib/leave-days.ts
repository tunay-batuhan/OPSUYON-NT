/**
 * Yıllık izin günü hesabı — 4857 sayılı İş Kanunu md. 56: izin süresine rastlayan hafta tatili, ulusal bayram
 * ve genel tatil günleri izin süresinden sayılmaz. Yarım gün tatiller (arife, 28 Ekim) 0,5 gün sayılır.
 *
 * Bu yalnızca ÖNERİDİR: vardiyalı çalışanın hafta tatili değişebilir, sözleşme farklı olabilir. Formda hafta
 * tatili seçilir, hesaplanan gün gösterilir; yönetici gün sayısını ve kalan izni her zaman elle değiştirebilir.
 */
export type Holiday = { day: string; name: string; half: boolean };

/** Hafta tatili seçenekleri: değer = sayılmayan günler (0 Pazar … 6 Cumartesi), virgülle. */
export const WEEKLY_REST_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Pazar" },
  { value: "6,0", label: "Cumartesi ve Pazar" },
  { value: "1", label: "Pazartesi" },
  { value: "2", label: "Salı" },
  { value: "3", label: "Çarşamba" },
  { value: "4", label: "Perşembe" },
  { value: "5", label: "Cuma" },
  { value: "6", label: "Cumartesi" },
  { value: "yok", label: "Yok — her gün sayılsın (vardiyalı)" },
];
export const DEFAULT_WEEKLY_REST = "0";

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const parseRest = (value: string | undefined): Set<number> =>
  new Set((value ?? DEFAULT_WEEKLY_REST).split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6));

export const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();

export type LeaveRules = { rest: Set<number>; holidays: Map<string, Holiday> };
export const leaveRules = (rest: string | undefined, holidays: Holiday[]): LeaveRules => ({
  rest: parseRest(rest),
  holidays: new Map(holidays.map((h) => [h.day, h])),
});
/** Takvim günü sayan kural (raporlu, babalık vb. bakiyeden düşmeyen izinler). */
export const CALENDAR_RULES: LeaveRules = { rest: new Set(), holidays: new Map() };

/** O gün izinden kaç gün düşer: hafta tatili / tam gün tatil 0, yarım gün tatil 0,5, diğer günler 1. */
export function dayValue(iso: string, rules: LeaveRules): number {
  if (rules.rest.has(weekday(iso))) return 0;
  const h = rules.holidays.get(iso);
  return h ? (h.half ? 0.5 : 0) : 1;
}

export type LeaveCount = {
  /** izinden düşen gün */
  days: number;
  /** takvim günü (başlangıç ve son gün dahil) */
  calendar: number;
  /** sayılmayan hafta tatili günleri */
  restDays: number;
  /** aralıktaki resmi tatiller (hafta tatiline denk gelmeyenler) */
  holidays: Holiday[];
};

/** Başlangıç–son gün (dahil) arasında izinden düşen gün sayısı ve neyin sayılmadığı. */
export function countLeaveDays(start: string, end: string, rules: LeaveRules): LeaveCount | null {
  if (!ISO.test(start) || !ISO.test(end) || end < start) return null;
  const out: LeaveCount = { days: 0, calendar: 0, restDays: 0, holidays: [] };
  for (let d = start; d <= end && out.calendar < 400; d = addDays(d, 1)) {
    out.calendar++;
    if (rules.rest.has(weekday(d))) out.restDays++;
    else {
      const h = rules.holidays.get(d);
      if (h) out.holidays.push(h);
      out.days += h ? (h.half ? 0.5 : 0) : 1;
    }
  }
  return out;
}

/** Başlangıçtan itibaren `days` gün izin kullanılınca iznin son günü (sayılmayan günler atlanır). */
export function endDateFor(start: string, days: number, rules: LeaveRules): string | null {
  if (!ISO.test(start) || !Number.isFinite(days) || days <= 0) return null;
  let acc = 0;
  let d = start;
  for (let i = 0; i < 800; i++) {
    acc += dayValue(d, rules);
    if (acc >= days) return d;
    d = addDays(d, 1);
  }
  return null;
}

/** İzin bitince işe dönülecek gün: son günden sonraki ilk çalışma günü (yarım gün tatil çalışma günüdür). */
export function returnDateFor(end: string, rules: LeaveRules): string | null {
  if (!ISO.test(end)) return null;
  let d = addDays(end, 1);
  for (let i = 0; i < 60; i++) {
    if (dayValue(d, rules) > 0) return d;
    d = addDays(d, 1);
  }
  return addDays(end, 1);
}

const shortDate = (iso: string) => `${Number(iso.slice(8, 10))}.${iso.slice(5, 7)}`;

/** "2 Pazar, 29.10 Cumhuriyet Bayramı, 28.10 … (yarım gün)" — neyin izinden sayılmadığı. */
export function skippedSummary(c: LeaveCount, rules: LeaveRules): string[] {
  const parts: string[] = [];
  if (c.restDays > 0) {
    const names = [...rules.rest].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((n) => DAY_NAMES[n]).join("/");
    parts.push(`${c.restDays} hafta tatili (${names})`);
  }
  for (const h of c.holidays) parts.push(`${shortDate(h.day)} ${h.name}${h.half ? " — yarım gün sayıldı" : ""}`);
  return parts;
}
