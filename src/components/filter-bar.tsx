import { Filter } from "lucide-react";
import { btn, cn, inputCls } from "@/components/ui";

export type FilterField = {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  /** Label for the "everything" choice; omit to force a selection. */
  all?: string;
};

/** Plain GET form (no JS needed): selected filters live in the URL, so pages are linkable. */
export function FilterBar({ action, fields, children }: { action: string; fields: FilterField[]; children?: React.ReactNode }) {
  return (
    <form action={action} method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
      {fields.map((f) => (
        <label key={f.name} className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
          <select name={f.name} defaultValue={f.value ?? ""} className={cn(inputCls, "h-9 min-w-36 w-auto pr-8")}>
            {f.all !== undefined && <option value="">{f.all}</option>}
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      <button className={btn("primary", "sm", "h-9")}>
        <Filter className="size-4" aria-hidden /> Filtrele
      </button>
      {children}
    </form>
  );
}

export const yearOptions = (span = 3) => {
  const y = new Date().getFullYear();
  return Array.from({ length: span + 1 }, (_, i) => y + 1 - i).map((v) => ({ value: String(v), label: String(v) }));
};
