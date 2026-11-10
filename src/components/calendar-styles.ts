import type { DayPickerProps } from "react-day-picker";

/** react-day-picker görünümü (filtre çubuğu aralık seçici ve form tarih alanları ortak). */
export const CALENDAR_CLASSES: DayPickerProps["classNames"] = {
  root: "relative",
  months: "flex flex-col gap-4 md:flex-row",
  month: "space-y-2",
  month_caption: "flex h-8 items-center px-1",
  caption_label: "text-sm font-semibold capitalize",
  nav: "absolute right-0 top-0 z-10 flex gap-1",
  button_previous: "grid size-8 place-items-center rounded-lg text-fg hover:bg-surface-2 disabled:opacity-30",
  button_next: "grid size-8 place-items-center rounded-lg text-fg hover:bg-surface-2 disabled:opacity-30",
  chevron: "size-4 fill-current",
  month_grid: "border-collapse",
  weekdays: "",
  weekday: "w-9 pb-1 text-xs font-medium text-muted",
  week: "",
  day: "p-0 text-center text-sm",
  day_button: "size-9 rounded-lg tabular-nums hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  today: "font-semibold text-brand",
  range_middle: "bg-brand-soft text-brand [&>button]:rounded-none [&>button]:hover:bg-brand-soft",
  range_start: "rounded-l-lg bg-brand-soft [&>button]:bg-brand [&>button]:text-white [&>button]:hover:bg-brand",
  range_end: "rounded-r-lg bg-brand-soft [&>button]:bg-brand [&>button]:text-white [&>button]:hover:bg-brand",
  selected: "",
  disabled: "text-muted opacity-40",
  outside: "invisible",
  hidden: "invisible",
};

/** "YYYY-AA-GG" ↔ yerel gece yarısı (yalnızca takvim günü; saat dilimi önemsiz). */
export const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtDay = (s: string) => s.split("-").reverse().join(".");
