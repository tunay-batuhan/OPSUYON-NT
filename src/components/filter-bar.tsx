import { Filter } from "lucide-react";
import { btn, cn, inputCls } from "@/components/ui";
import { NavForm } from "@/components/nav-progress";
import { DateRangeField } from "@/components/date-range-field";

export type FilterField = {
  name: string;
  label: string;
  value?: string;
  /** "text": serbest arama kutusu; "daterange": takvimden tarih aralığı (name → başlangıç, nameTo → bitiş); varsayılan açılır liste. */
  kind?: "select" | "text" | "daterange";
  /** "daterange": bitiş alanının adı ve değeri (YYYY-AA-GG) */
  nameTo?: string;
  valueTo?: string;
  /** "daterange": seçilebilecek en erken / en geç gün (YYYY-AA-GG) */
  min?: string;
  max?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Label for the "everything" choice; omit to force a selection. */
  all?: string;
};

/**
 * GET formu: seçilen filtreler adreste durur (sayfa paylaşılabilir). next/form ile sayfa baştan yüklenmeden
 * gider ve üstteki ilerleme çubuğu çalışır; JavaScript yoksa normal form gibi çalışır.
 */
export function FilterBar({ action, fields, children }: { action: string; fields: FilterField[]; children?: React.ReactNode }) {
  return (
    // key: adres değişince (geri tuşu, bağlantı) kutular yeni değerlerle yeniden çizilir
    <NavForm
      key={fields.map((f) => `${f.name}=${f.value ?? ""}${f.valueTo ? `~${f.valueTo}` : ""}`).join("&")}
      action={action}
      className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card"
    >
      {fields.map((f) =>
        f.kind === "daterange" ? (
          // label değil: takvimdeki tıklamalar etiketin düğmesine aktarılmasın
          <div key={f.name} className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
            <DateRangeField name={f.name} nameTo={f.nameTo ?? `${f.name}_bitis`} from={f.value ?? ""} to={f.valueTo ?? f.value ?? ""} min={f.min} max={f.max} />
          </div>
        ) : (
          <label key={f.name} className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
            {f.kind === "text" ? (
              <input
                name={f.name}
                type="search"
                defaultValue={f.value ?? ""}
                placeholder={f.placeholder}
                autoComplete="off"
                maxLength={60}
                className={cn(inputCls, "h-9 w-48")}
              />
            ) : (
              <select name={f.name} defaultValue={f.value ?? ""} className={cn(inputCls, "h-9 min-w-36 w-auto pr-8")}>
                {f.all !== undefined && <option value="">{f.all}</option>}
                {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </label>
        ),
      )}
      <button className={btn("primary", "sm", "h-9")}>
        <Filter className="size-4" aria-hidden /> Filtrele
      </button>
      {children}
    </NavForm>
  );
}

export const yearOptions = (span = 3) => {
  const y = new Date().getFullYear();
  return Array.from({ length: span + 1 }, (_, i) => y + 1 - i).map((v) => ({ value: String(v), label: String(v) }));
};
