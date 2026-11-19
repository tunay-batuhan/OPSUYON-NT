"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, FileDown, Loader2, RotateCcw, Save, Undo2 } from "lucide-react";
import { savePayrollLines } from "@/app/actions/payroll";
import { toNumber } from "@/lib/parse";
import { GROUP_LABEL, computeRow, sumRows, type Cells, type PayCol, type PayGroup } from "@/lib/payroll-engine";
import { cellFmt, type PayrollLineView } from "@/lib/payroll-shared";
import type { LineCells } from "@/lib/schemas-payroll";
import { btn, cn } from "@/components/ui";
import { ActionResult } from "./action-result";
import { useAction } from "./use-action";

/** Bir satırdaki kaydedilmemiş değişiklikler: { kod: yazılan metin } ve formüle / ilk değere döndürülen kodlar. */
type RowEdit = { typed: Record<string, string>; cleared: string[] };

const th = "whitespace-nowrap px-2 py-2 text-right font-medium";
const tdN = "whitespace-nowrap px-2 py-1.5 text-right tabular-nums";
const GROUP_TONE: Record<PayGroup, string> = {
  bilgi: "bg-surface-2/60",
  kazanc: "bg-[color-mix(in_oklab,var(--tone-emerald-soft)_60%,var(--surface))]",
  kesinti: "bg-[color-mix(in_oklab,var(--tone-rose-soft)_60%,var(--surface))]",
  odeme: "bg-[color-mix(in_oklab,var(--tone-blue-soft)_60%,var(--surface))]",
};

/** Yazılan metin → sayı (Türkçe yazım: 1.234,56); boş → null (formüle dön), geçersiz → undefined. */
function parseCell(text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  const n = toNumber(t);
  return n === null || Math.abs(n) > 99_999_999 ? undefined : Math.round(n * 100) / 100;
}
const plain = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2, useGrouping: false }).format(n);

/**
 * Ay sonu maaş tablosu. Sütunlar ve formüller dönemin ŞABLONUNDAN gelir (varsayılan: müşterinin Excel düzeni).
 * Her hücre düzenlenebilir: giriş sütunu doğrudan yazılır; formül sütununa yazılan sayı o personel için formülü ezer
 * (sarı işaretlenir, ↺ ile formüle dönülür). Tutarlar yazarken hesaplanır; "Kaydet ve hesapla" değişen satırları gönderir.
 */
export function PayrollTable({ runId, columns, lines, editable }: { runId: string; columns: PayCol[]; lines: PayrollLineView[]; editable: boolean }) {
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const { pending, result, run } = useAction();

  /** Satırın o anki hücreleri (kaydedilmiş + yazılanlar) ve geçersiz hücre kodları. */
  const merged = (l: PayrollLineView): { cells: Cells; invalid: string[]; changed: LineCells["cells"] } => {
    const e = edits[l.id];
    const cells: Cells = { ...l.cells };
    const invalid: string[] = [];
    const changed: LineCells["cells"] = {};
    if (!e) return { cells, invalid, changed };
    for (const code of e.cleared) {
      if (code in cells) changed[code] = null;
      delete cells[code];
    }
    for (const [code, text] of Object.entries(e.typed)) {
      const col = columns.find((c) => c.code === code);
      if (!col) continue;
      if (col.kind === "text") {
        const t = text.trim().slice(0, 120);
        if (t !== (typeof l.cells[code] === "string" ? l.cells[code] : "")) changed[code] = t || null;
        if (t) cells[code] = t;
        else delete cells[code];
        continue;
      }
      const n = parseCell(text);
      if (n === undefined) { invalid.push(code); continue; }
      if (n === null) {
        if (code in l.cells) changed[code] = null;
        delete cells[code];
      } else {
        if (l.cells[code] !== n) changed[code] = n;
        cells[code] = n;
      }
    }
    return { cells, invalid, changed };
  };

  const live = useMemo(
    () =>
      lines.map((l) => {
        const m = merged(l);
        return { line: l, ...m, res: computeRow(columns, m.cells, l.vars) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merged yalnızca edits, lines ve columns'a bağlı
    [lines, columns, edits],
  );
  const totals = useMemo(() => sumRows(columns, live.map((r) => r.res)), [columns, live]);
  const dirty = live.filter((r) => Object.keys(r.changed).length > 0);
  const invalid = live.some((r) => r.invalid.length > 0);

  const type = (id: string, code: string, text: string) =>
    setEdits((e) => {
      const row = e[id] ?? { typed: {}, cleared: [] };
      return { ...e, [id]: { typed: { ...row.typed, [code]: text }, cleared: row.cleared.filter((c) => c !== code) } };
    });
  const reset = (id: string, code: string) =>
    setEdits((e) => {
      const row = e[id] ?? { typed: {}, cleared: [] };
      const typed = { ...row.typed };
      delete typed[code];
      return { ...e, [id]: { typed, cleared: [...new Set([...row.cleared, code])] } };
    });

  function save() {
    const rows: LineCells[] = dirty.map((r) => ({ id: r.line.id, cells: r.changed }));
    run(() => savePayrollLines({ run_id: runId, rows }), () => setEdits({}));
  }

  // aynı başlıklı sütunlar (ör. kazançta ve ödemede "Destek ödeme") ekran okuyucuda grubuyla ayırt edilir
  const dup = new Set(columns.map((c) => c.label).filter((l, i, a) => a.indexOf(l) !== i));
  const nameOf = (c: PayCol) => (dup.has(c.label) ? `${c.label} (${GROUP_LABEL[c.group]})` : c.label);

  // grup başlıkları (ardışık aynı grup tek hücre)
  const groups: { group: PayGroup; span: number }[] = [];
  for (const c of columns) {
    const last = groups.at(-1);
    if (last && last.group === c.group) last.span++;
    else groups.push({ group: c.group, span: 1 });
  }
  const groupStart = new Set<number>();
  columns.reduce((i, c, idx) => { if (idx === 0 || columns[idx - 1].group !== c.group) groupStart.add(idx); return i; }, 0);

  return (
    <div>
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-sm text-muted">
            {dirty.length
              ? `${dirty.length} satırda kaydedilmemiş değişiklik var.`
              : "Her hücre değiştirilebilir. Formüllü hücreye sayı yazarsanız o personel için formül ezilir (sarı); ↺ ile formüle dönersiniz."}
          </p>
          <div className="flex items-center gap-2">
            {dirty.length > 0 && (
              <button type="button" onClick={() => setEdits({})} disabled={pending} className={btn("ghost", "sm")}>
                <Undo2 className="size-4" aria-hidden /> Vazgeç
              </button>
            )}
            <button type="button" onClick={save} disabled={pending || dirty.length === 0 || invalid} className={btn("primary", "sm")}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />} Kaydet ve hesapla
            </button>
          </div>
        </div>
      )}
      {invalid && <p role="alert" className="border-b border-border bg-danger-soft px-5 py-2 text-sm text-danger">Kırmızı işaretli hücrelerde geçersiz değer var (sayı yazın; kuruş için virgül: 1.234,56).</p>}
      <ActionResult result={result} className="mx-5 mt-3" />

      <div className="relative overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="sticky left-0 z-20 bg-surface-2 px-3 py-1.5 text-left font-medium" rowSpan={2}>Adı soyadı</th>
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} className={cn("border-l border-border px-2 py-1.5 text-center font-semibold", GROUP_TONE[g.group])}>{GROUP_LABEL[g.group]}</th>
              ))}
              <th className="bg-surface-2 px-2" rowSpan={2}><span className="sr-only">Bordro PDF</span></th>
            </tr>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              {columns.map((c, i) => (
                <th key={c.code} className={cn(th, GROUP_TONE[c.group], groupStart.has(i) && "border-l border-border", c.kind === "text" && "text-left")} title={c.kind === "formula" ? `= ${c.formula}` : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {live.map(({ line: l, res, invalid: bad, changed }) => {
              const isDirty = Object.keys(changed).length > 0;
              const e = edits[l.id];
              return (
                <tr key={l.id} className={cn(isDirty && "bg-warning-soft/30")}>
                  <td className={cn("sticky left-0 z-10 border-t border-border px-3 py-1.5", isDirty ? "bg-[color-mix(in_oklab,var(--warning-soft)_35%,var(--surface))]" : "bg-surface")}>
                    <p className="whitespace-nowrap font-medium">{l.full_name}</p>
                    {l.has_rates ? (
                      l.title && <p className="text-xs text-muted">{l.title}</p>
                    ) : (
                      <Link href="/bordrolar/ucretler" className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger hover:underline">
                        <AlertTriangle className="size-3" aria-hidden /> Ücret tanımı yok
                      </Link>
                    )}
                  </td>
                  {columns.map((c, i) => {
                    const cellCls = cn("border-t border-border", groupStart.has(i) && "border-l");
                    const typed = e?.typed[c.code];
                    if (c.kind === "text") {
                      const val = typed ?? res.texts[c.code] ?? "";
                      return (
                        <td key={c.code} className={cn(cellCls, "px-2 py-1.5")}>
                          {editable ? (
                            <input value={val} onChange={(ev) => type(l.id, c.code, ev.target.value)} maxLength={120} aria-label={`${l.full_name} — ${nameOf(c)}`} className="h-8 w-24 rounded-md border border-border bg-surface px-2 text-sm focus:border-brand focus:outline-none" />
                          ) : (
                            <span className="whitespace-nowrap">{val || "—"}</span>
                          )}
                        </td>
                      );
                    }
                    const v = res.values[c.code] ?? 0;
                    const over = c.kind === "formula" && res.overridden.includes(c.code);
                    if (!editable) {
                      return (
                        <td key={c.code} className={cn(cellCls, tdN, c.group === "odeme" && "font-semibold", v < 0 && "text-danger")} title={over ? "Elle girildi" : undefined}>
                          {cellFmt(c, v)}{over && <span className="ml-0.5 text-warning" aria-hidden>*</span>}
                        </td>
                      );
                    }
                    const isBad = bad.includes(c.code);
                    return (
                      <td key={c.code} className={cn(cellCls, "px-1 py-1 text-right")}>
                        <span className="inline-flex items-center gap-0.5">
                          {over && (
                            <button type="button" onClick={() => reset(l.id, c.code)} title="Formüle dön" aria-label={`${l.full_name} — ${nameOf(c)}: formüle dön`} className="grid size-6 place-items-center rounded text-warning hover:bg-warning-soft">
                              <RotateCcw className="size-3.5" aria-hidden />
                            </button>
                          )}
                          <input
                            value={typed ?? plain(Math.round(v * 100) / 100)}
                            onChange={(ev) => type(l.id, c.code, ev.target.value)}
                            onFocus={(ev) => ev.target.select()}
                            inputMode="decimal"
                            aria-label={`${l.full_name} — ${nameOf(c)}`}
                            aria-invalid={isBad || undefined}
                            title={c.kind === "formula" ? (over ? "Elle girildi (formül ezildi)" : `= ${c.formula}`) : undefined}
                            className={cn(
                              "h-8 w-[5.5rem] rounded-md border px-1.5 text-right text-sm tabular-nums focus:border-brand focus:outline-none",
                              c.kind === "formula" ? "border-transparent bg-surface-2/70 text-fg" : "border-border bg-surface",
                              over && "border-warning bg-warning-soft/60",
                              c.group === "odeme" && "font-semibold",
                              v < 0 && "text-danger",
                              isBad && "border-danger bg-danger-soft",
                            )}
                          />
                        </span>
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap border-t border-border px-2 py-1.5 text-right">
                    <a href={`/api/bordro/satir/${l.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline" aria-label={`${l.full_name} bordro PDF`}>
                      <FileDown className="size-3.5" aria-hidden /> PDF
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="sticky left-0 z-10 border-t-2 border-border bg-surface-2 px-3 py-2.5">TOPLAM · {lines.length} kişi</td>
              {columns.map((c, i) => (
                <td key={c.code} className={cn("border-t-2 border-border bg-surface-2/60", tdN, groupStart.has(i) && "border-l")}>
                  {c.total && c.kind !== "text" ? cellFmt(c, totals[c.code]) : ""}
                </td>
              ))}
              <td className="border-t-2 border-border bg-surface-2/60" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
