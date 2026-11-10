"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { DayPicker } from "react-day-picker";
import { tr } from "react-day-picker/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/components/ui";
import { Shell, control } from "@/components/forms/form";
import { CALENDAR_CLASSES, fmtDay, toDate, toStr } from "@/components/calendar-styles";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const opts = { shouldDirty: true, shouldValidate: true } as const;

/** Tetikleyici kutu + açılır takvim; dışarı tıklayınca veya Esc ile kapanır. */
function CalendarPopover({
  id, label, placeholder, invalid, describedBy, open, setOpen, align = "left", children,
}: {
  id: string; label: string; placeholder: string; invalid: boolean; describedBy?: string;
  open: boolean; setOpen: (v: boolean) => void; align?: "left" | "right"; children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={box} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        className={cn(control, "flex h-10 items-center gap-2 pr-2 text-left", invalid && "border-danger bg-danger-soft/40")}
      >
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
        <span className={cn("flex-1 truncate tabular-nums", label ? "" : "text-muted/60")}>{label || placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={placeholder}
          className={cn(
            "absolute top-full z-40 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-3 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Form içi tek tarih alanı (YYYY-AA-GG), takvimden seçilir. */
export function DateField({
  name, label, hint, required, className, align,
}: { name: string; label: string; hint?: string; required?: boolean; className?: string; align?: "left" | "right" }) {
  const { control: ctl, setValue, formState } = useFormContext();
  const value = (useWatch({ control: ctl, name }) as string) ?? "";
  const [open, setOpen] = useState(false);
  const id = useId();
  const error = formState.errors[name]?.message as string | undefined;
  const ok = ISO.test(value);
  return (
    <Shell id={id} label={label} hint={hint} required={required} error={error} className={className}>
      <CalendarPopover
        id={id} label={ok ? fmtDay(value) : ""} placeholder="Tarih seçin" invalid={Boolean(error)}
        describedBy={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        open={open} setOpen={setOpen} align={align}
      >
        <DayPicker
          mode="single"
          locale={tr}
          defaultMonth={ok ? toDate(value) : undefined}
          selected={ok ? toDate(value) : undefined}
          onSelect={(_, day) => {
            setValue(name, toStr(day), opts);
            setOpen(false);
          }}
          classNames={{ ...CALENDAR_CLASSES, selected: "[&>button]:bg-brand [&>button]:text-white [&>button]:hover:bg-brand" }}
        />
      </CalendarPopover>
    </Shell>
  );
}

/**
 * Form içi tarih aralığı: takvimde başlangıç gününe, sonra bitiş gününe tıklanır; iki alan (`name`, `nameTo`)
 * birlikte dolar. `onRange` seçim bitince çağrılır (ör. gün sayısını güncellemek için).
 */
export function DateRangeFormField({
  name, nameTo, label, hint, required, className, align, onRange,
}: {
  name: string; nameTo: string; label: string; hint?: string; required?: boolean; className?: string; align?: "left" | "right";
  onRange?: (from: string, to: string) => void;
}) {
  const { control: ctl, setValue, formState } = useFormContext();
  const [from, to] = useWatch({ control: ctl, name: [name, nameTo] }) as string[];
  const [open, setOpenState] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [months, setMonths] = useState(1);
  const id = useId();
  const error = (formState.errors[name]?.message ?? formState.errors[nameTo]?.message) as string | undefined;

  const setOpen = (v: boolean) => {
    if (v) setMonths(window.matchMedia("(min-width: 768px)").matches ? 2 : 1);
    setOpenState(v);
    setAnchor(null);
    setHover(null);
  };

  function pick(day: Date) {
    const d = toStr(day);
    if (!anchor) {
      setAnchor(d);
      setHover(d);
      return;
    }
    const [f, t] = anchor <= d ? [anchor, d] : [d, anchor];
    setValue(name, f, opts);
    setValue(nameTo, t, opts);
    onRange?.(f, t);
    setOpen(false);
  }

  const has = ISO.test(from ?? "") && ISO.test(to ?? "");
  const shown = anchor
    ? (() => {
        const other = hover ?? anchor;
        const [f, t] = anchor <= other ? [anchor, other] : [other, anchor];
        return { from: toDate(f), to: toDate(t) };
      })()
    : has
      ? { from: toDate(from), to: toDate(to) }
      : undefined;
  const text = has ? (from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`) : "";

  return (
    <Shell id={id} label={label} hint={hint} required={required} error={error} className={className}>
      <CalendarPopover
        id={id} label={text} placeholder="Başlangıç ve bitiş seçin" invalid={Boolean(error)}
        describedBy={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        open={open} setOpen={setOpen} align={align}
      >
        <DayPicker
          mode="range"
          locale={tr}
          numberOfMonths={months}
          defaultMonth={has ? toDate(from) : undefined}
          selected={shown}
          onSelect={(_, day) => pick(day)}
          onDayMouseEnter={(day) => anchor && setHover(toStr(day))}
          classNames={CALENDAR_CLASSES}
        />
        <p className="mt-2 px-1 text-xs text-muted">
          {anchor ? `Başlangıç ${fmtDay(anchor)} — şimdi son günü seçin.` : "Önce izin başlangıcına, sonra son güne tıklayın."}
        </p>
      </CalendarPopover>
    </Shell>
  );
}
