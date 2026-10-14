"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Eraser, Loader2, Wand2 } from "lucide-react";
import { applyShiftsToTimesheet, setShifts } from "@/app/actions/shifts";
import { btn, cn } from "@/components/ui";

type ShiftType = { code: string; name: string; color: string; is_off: boolean; start: string | null; end: string | null };
type Person = { id: string; name: string };

const WEEKDAYS = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Monthly roster. Pick a shift in the palette, click cells to paint (click again to erase). */
export function ShiftGrid({
  projectId, year, month, people, types, initial, canEdit, canApplyToTimesheet,
}: {
  projectId: string; year: number; month: number; people: Person[]; types: ShiftType[];
  initial: Record<string, string>; canEdit: boolean; canApplyToTimesheet: boolean;
}) {
  const days = new Date(year, month, 0).getDate();
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const [brush, setBrush] = useState<string>(types.find((t) => !t.is_off)?.code ?? types[0]?.code ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const byCode = new Map(types.map((t) => [t.code, t]));
  const key = (pid: string, d: number) => `${pid}|${year}-${pad(month)}-${pad(d)}`;

  function paint(entries: { personnelId: string; day: number; code: string }[]) {
    const prev = { ...cells };
    setCells((c) => {
      const next = { ...c };
      for (const e of entries) {
        if (e.code) next[key(e.personnelId, e.day)] = e.code;
        else delete next[key(e.personnelId, e.day)];
      }
      return next;
    });
    setMsg(null);
    startTransition(async () => {
      const res = await setShifts({
        projectId,
        entries: entries.map((e) => ({ personnelId: e.personnelId, date: `${year}-${pad(month)}-${pad(e.day)}`, code: e.code })),
      });
      if (res?.error) {
        setCells(prev);
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  function onCell(pid: string, d: number) {
    if (!canEdit) return;
    const current = cells[key(pid, d)];
    paint([{ personnelId: pid, day: d, code: brush === "" || current === brush ? "" : brush }]);
  }

  function fillRow(pid: string) {
    if (!canEdit || !brush) return;
    paint(Array.from({ length: days }, (_, i) => ({ personnelId: pid, day: i + 1, code: brush })));
  }

  const workedOf = (pid: string) =>
    Array.from({ length: days }, (_, i) => cells[key(pid, i + 1)]).filter((c) => c && !byCode.get(c)?.is_off).length;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 shadow-card" role="group" aria-label="Vardiya fırçası">
          <span className="mr-1 text-xs font-medium text-muted">Fırça:</span>
          {types.map((t) => (
            <button
              key={t.code}
              onClick={() => setBrush(t.code)}
              aria-pressed={brush === t.code}
              className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition", brush === t.code ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-surface-2")}
            >
              <span className="grid size-5 place-items-center rounded text-[11px] font-bold text-white" style={{ background: t.color }}>{t.code}</span>
              {t.name}{t.start && t.end ? ` · ${t.start.slice(0, 5)}–${t.end.slice(0, 5)}` : ""}
            </button>
          ))}
          <button
            onClick={() => setBrush("")}
            aria-pressed={brush === ""}
            className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition", brush === "" ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-surface-2")}
          >
            <Eraser className="size-4" aria-hidden /> Sil
          </button>
        </div>
      )}
      {!canEdit && (
        <div className="flex flex-wrap gap-2 text-xs">
          {types.map((t) => (
            <span key={t.code} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1">
              <span className="grid size-5 place-items-center rounded text-[11px] font-bold text-white" style={{ background: t.color }}>{t.code}</span>
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface-2/70">
              <th scope="col" className="sticky left-0 z-10 min-w-44 bg-surface-2 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted">Personel</th>
              {Array.from({ length: days }, (_, i) => {
                const dow = new Date(year, month - 1, i + 1).getDay();
                const weekend = dow === 0 || dow === 6;
                return (
                  <th key={i} scope="col" className={cn("w-8 min-w-8 px-0.5 py-1.5 text-center font-medium", weekend && "bg-surface-2 text-danger")}>
                    <span className="block text-[10px] opacity-70">{WEEKDAYS[dow]}</span>
                    {i + 1}
                  </th>
                );
              })}
              <th scope="col" className="min-w-14 px-2 py-2 text-center text-[11px] font-medium uppercase text-muted">Gün</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-sm font-medium">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    {canEdit && (
                      <button onClick={() => fillRow(p.id)} className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-brand hover:bg-brand-soft" title="Seçili fırça ile tüm ayı doldur">Tüm ay</button>
                    )}
                  </span>
                </th>
                {Array.from({ length: days }, (_, i) => {
                  const d = i + 1;
                  const code = cells[key(p.id, d)];
                  const t = code ? byCode.get(code) : undefined;
                  const dow = new Date(year, month - 1, d).getDay();
                  return (
                    <td key={d} className={cn("p-0.5 text-center", (dow === 0 || dow === 6) && "bg-surface-2/60")}>
                      <button
                        disabled={!canEdit}
                        onClick={() => onCell(p.id, d)}
                        aria-label={`${p.name}, ${d}. gün${t ? `, ${t.name}` : ", boş"}`}
                        className={cn("grid h-7 w-full min-w-7 place-items-center rounded font-bold transition", t ? "text-white" : "text-transparent hover:bg-surface-2", !canEdit && "cursor-default!")}
                        style={t ? { background: t.color } : undefined}
                      >
                        {code ?? "·"}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 text-center font-semibold tabular-nums">{workedOf(p.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canApplyToTimesheet && (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await applyShiftsToTimesheet({ projectId, year, month });
                setMsg(res?.ok ? { ok: true, text: res.message ?? "Puantaj güncellendi." } : { ok: false, text: res?.error ?? "İşlem başarısız." });
              })
            }
            className={btn("secondary", "md")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
            Planı puantaja aktar
          </button>
        )}
        {pending && <span className="text-xs text-muted">Kaydediliyor…</span>}
        {msg && (
          <span role={msg.ok ? "status" : "alert"} className={cn("flex items-center gap-1.5 text-sm", msg.ok ? "text-success" : "text-danger")}>
            {msg.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertCircle className="size-4" aria-hidden />} {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
