"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { tr } from "react-day-picker/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn, inputCls } from "@/components/ui";

/** "YYYY-AA-GG" ↔ yerel gece yarısı (yalnızca takvim günü; saat dilimi önemsiz). */
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (s: string) => s.split("-").reverse().join(".");
const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};

/**
 * Filtre çubuğu için tarih aralığı: takvimde başlangıç ve bitiş gününe tıklanır (ya da hazır aralık seçilir),
 * seçim bitince form kendiliğinden gönderilir. Değerler gizli `name` / `nameTo` alanlarıyla (YYYY-AA-GG) gider.
 */
export function DateRangeField({
  name, nameTo, from, to, min, max,
}: { name: string; nameTo: string; from: string; to: string; min?: string; max?: string }) {
  const [range, setRange] = useState({ from, to });
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null); // ilk tıklanan gün (bitiş bekleniyor)
  const [hover, setHover] = useState<string | null>(null);
  const [months, setMonths] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const submitNext = useRef(false);

  // seçim bittiğinde gizli alanlar güncellendikten sonra formu gönder
  useEffect(() => {
    if (!submitNext.current) return;
    submitNext.current = false;
    hiddenRef.current?.form?.requestSubmit();
  }, [range]);

  // dışarı tıklayınca / Esc ile kapanır (yarım kalan seçim bırakılır)
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setAnchor(null);
      setHover(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(a: string, b: string) {
    const [f, t] = a <= b ? [a, b] : [b, a];
    setRange({ from: f, to: t });
    setAnchor(null);
    setHover(null);
    setOpen(false);
    submitNext.current = true;
  }

  function pick(day: Date) {
    const d = toStr(day);
    if (!anchor) {
      setAnchor(d);
      setHover(d);
    } else commit(anchor, d);
  }

  // takvimde gösterilen aralık: seçim sürerken başlangıç ile imlecin üstündeki gün arası
  const shown = anchor
    ? (() => {
        const other = hover ?? anchor;
        const [f, t] = anchor <= other ? [anchor, other] : [other, anchor];
        return { from: toDate(f), to: toDate(t) };
      })()
    : { from: toDate(range.from), to: toDate(range.to) };

  const today = max ?? toStr(new Date());
  const presets = [
    { label: "Bugün", from: today, to: today },
    { label: "Dün", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Son 7 gün", from: addDays(today, -6), to: today },
  ];
  const monthStart = `${today.slice(0, 8)}01`;
  presets.push({ label: "Bu ay", from: min && min > monthStart ? min : monthStart, to: today });
  presets.push({ label: min ? "Son 1 ay" : "Son 30 gün", from: min ?? addDays(today, -29), to: today });

  const label = range.from === range.to ? fmt(range.from) : `${fmt(range.from)} – ${fmt(range.to)}`;

  return (
    <div ref={box} className="relative">
      <input ref={hiddenRef} type="hidden" name={name} value={range.from} />
      <input type="hidden" name={nameTo} value={range.to} />
      <button
        type="button"
        onClick={() => {
          if (!open) setMonths(window.matchMedia("(min-width: 768px)").matches ? 2 : 1);
          setOpen((o) => !o);
          setAnchor(null);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(inputCls, "flex h-9 w-auto min-w-56 items-center gap-2 pr-2 text-left")}
      >
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="flex-1 tabular-nums">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div role="dialog" aria-label="Tarih aralığı seçin" className="absolute left-0 top-full z-40 mt-2 flex max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg sm:flex-row">
          <div className="flex flex-wrap gap-1.5 sm:w-32 sm:flex-col sm:border-r sm:border-border sm:pr-3">
            {presets.map((p) => {
              const on = !anchor && p.from === range.from && p.to === range.to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => commit(p.from, p.to)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-left text-sm",
                    on ? "bg-brand-soft font-medium text-brand" : "text-fg hover:bg-surface-2",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div>
            <DayPicker
              mode="range"
              locale={tr}
              numberOfMonths={months}
              defaultMonth={months === 2 ? toDate(addDays(range.to, -31)) : toDate(range.to)}
              startMonth={min ? toDate(min) : undefined}
              endMonth={toDate(today)}
              disabled={[...(min ? [{ before: toDate(min) }] : []), { after: toDate(today) }]}
              selected={shown}
              onSelect={(_, day) => pick(day)}
              onDayMouseEnter={(day) => anchor && setHover(toStr(day))}
              classNames={{
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
              }}
            />
            <p className="mt-2 px-1 text-xs text-muted">{anchor ? `Başlangıç ${fmt(anchor)} — şimdi bitiş gününü seçin.` : "Başlangıç gününe, sonra bitiş gününe tıklayın."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
