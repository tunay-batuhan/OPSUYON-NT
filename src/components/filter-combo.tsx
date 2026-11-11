"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn, inputCls } from "@/components/ui";
import { matches } from "@/lib/text";

const MAX_RESULTS = 50;

/**
 * Filtre çubuğu için yazarak aranabilir seçim kutusu (ör. firma): yazdıkça eşleşenler altta listelenir
 * (Türkçe harf farkı gözetilmez). Seçilince ya da temizlenince form kendiliğinden gönderilir; değer gizli
 * `name` alanıyla gider.
 */
export function FilterCombo({
  name, label: fieldLabel, value, options, all, placeholder = "Yazarak arayın…",
}: { name: string; label: string; value: string; options: { value: string; label: string }[]; all?: string; placeholder?: string }) {
  const [selected, setSelected] = useState(value);
  const label = options.find((o) => o.value === selected)?.label ?? "";
  const [text, setText] = useState(label);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hidden = useRef<HTMLInputElement>(null);
  const submitNext = useRef(false);
  const listId = `${name}-combo-list`;

  // seçim değişince gizli alan güncellendikten sonra formu gönder
  useEffect(() => {
    if (!submitNext.current) return;
    submitNext.current = false;
    hidden.current?.form?.requestSubmit();
  }, [selected]);

  const shown = useMemo(() => (query ? options.filter((o) => matches(o.label, query)) : options), [options, query]);
  const choose = (v: string) => {
    const l = options.find((o) => o.value === v)?.label ?? "";
    setText(l);
    setQuery("");
    setOpen(false);
    if (v !== selected) {
      submitNext.current = true;
      setSelected(v);
    }
  };

  return (
    <div className="relative w-64 max-w-full">
      <input ref={hidden} type="hidden" name={name} value={selected} />
      <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted" aria-hidden />
      <input
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-label={fieldLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        value={text}
        placeholder={selected ? placeholder : (all ?? placeholder)}
        className={cn(inputCls, "h-9 pl-9 pr-14")}
        onChange={(e) => {
          setText(e.target.value);
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery("");
          setText(label);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            else setActive((a) => Math.min(a + 1, Math.min(shown.length, MAX_RESULTS) - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault(); // yarım yazıyla formu göndermesin
            if (open && shown[active]) choose(shown[active].value);
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
            setQuery("");
            setText(label);
          }
        }}
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        {selected && (
          <button
            type="button" tabIndex={-1} aria-label="Seçimi temizle"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose("")}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
        <ChevronDown className="pointer-events-none mx-1 size-4 text-muted" aria-hidden />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Seçenekler"
          onMouseDown={(e) => e.preventDefault()} // tıklarken kutu odağı kaybetmesin
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-surface py-1 text-sm shadow-lg"
        >
          {all !== undefined && !query && (
            <li role="option" aria-selected={!selected} onClick={() => choose("")} className={cn("cursor-pointer px-3 py-2 text-muted hover:bg-surface-2", !selected && "font-medium text-brand")}>
              {all}
            </li>
          )}
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-muted">{`"${query}" ile eşleşen yok`}</li>
          ) : (
            shown.slice(0, MAX_RESULTS).map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2",
                  i === active && "bg-brand-soft",
                  o.value === selected && "font-medium text-brand",
                )}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {o.value === selected && <Check className="size-4 shrink-0" aria-hidden />}
              </li>
            ))
          )}
          {shown.length > MAX_RESULTS && <li className="border-t border-border px-3 py-2 text-xs text-muted">{shown.length - MAX_RESULTS} kayıt daha; yazarak daraltın.</li>}
        </ul>
      )}
    </div>
  );
}
