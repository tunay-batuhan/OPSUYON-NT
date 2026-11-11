"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { updateLeaveBalance, updateLeaveDays } from "@/app/actions/leaves";
import type { ActionState } from "@/lib/action-types";
import { btn, cn, inputCls } from "@/components/ui";

const num = (v: string) => Number(v.replace(",", "."));
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—");
const toField = (n: number) => String(n).replace(".", ",");

/** Küçük düzeltme penceresi (tarayıcının <dialog> öğesi: odak kilidi ve Esc ile kapanma hazır gelir). */
function EditDialog({
  trigger, triggerLabel, title, description, children, onSave, onOpen,
}: {
  trigger: ReactNode; triggerLabel: string; title: string; description?: ReactNode; children: ReactNode;
  onSave: () => Promise<ActionState>; onOpen?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => { setError(null); onOpen?.(); ref.current?.showModal(); }}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-surface p-0 text-left text-fg shadow-[0_24px_64px_rgb(12_31_69/0.28)] ring-1 ring-border backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]"
      >
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await onSave();
              if (res?.ok) ref.current?.close();
              else setError(res?.error ?? "Kaydedilemedi.");
            });
          }}
          className="p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-base font-semibold leading-snug">{title}</h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Kapat" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {description && <div className="mt-1 text-sm leading-relaxed text-muted">{description}</div>}
          <div className="mt-4 space-y-3">{children}</div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => ref.current?.close()} className={btn("secondary", "md", "sm:min-w-24")}>Vazgeç</button>
            <button type="submit" disabled={pending} className={btn("primary", "md", "sm:min-w-24")}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Kaydet
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function NumberInput({ label, value, onChange, hint, autoFocus }: { label: string; value: string; onChange: (v: string) => void; hint?: string; autoFocus?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          id={id} inputMode="decimal" autoComplete="off" autoFocus={autoFocus} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputCls, "h-10 pr-12 tabular-nums")}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">gün</span>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** İzin kaydının gün sayısını elle düzelt (yarım gün, resmi tatil, vardiya gibi durumlar). */
export function LeaveDaysEdit({ id, days, name }: { id: string; days: number; name: string }) {
  const [value, setValue] = useState(toField(days));
  return (
    <EditDialog
      trigger={<Pencil className="size-3.5" aria-hidden />}
      triggerLabel={`${name} — izin gününü düzelt`}
      title="İzin gününü düzelt"
      description={<>{name} için bu izinde bakiyeden düşecek gün. Yarım gün için 0,5 yazabilirsiniz; tarihler değişmez.</>}
      onOpen={() => setValue(toField(days))}
      onSave={() => updateLeaveDays({ id, days: value })}
    >
      <NumberInput label="Gün (izin süresi)" value={value} onChange={setValue} autoFocus />
    </EditDialog>
  );
}

/**
 * Yıllık izin bakiyesini elle düzelt. "Kalan izin" doğrudan yazılabilir: yazılınca Hak edilen ona göre ayarlanır.
 * `recorded`: o yıl kaydedilmiş yıllık izin günleri (kayıtlardan gelir, buradan değişmez).
 */
export function LeaveBalanceEdit({
  id, name, year, entitled, carried, used, recorded,
}: { id: string; name: string; year: number; entitled: number; carried: number; used: number; recorded: number }) {
  const [e, setE] = useState(toField(entitled));
  const [c, setC] = useState(toField(carried));
  const [u, setU] = useState(toField(used));
  const [note, setNote] = useState("");
  const noteId = useId();
  const left = num(e) + num(c) - num(u) - recorded;
  const [leftText, setLeftText] = useState<string | null>(null); // yazılırken ham metin

  const reset = () => { setE(toField(entitled)); setC(toField(carried)); setU(toField(used)); setNote(""); setLeftText(null); };

  return (
    <EditDialog
      trigger={<><Pencil className="size-3.5" aria-hidden /> Düzelt</>}
      triggerLabel={`${name} — izin bakiyesini düzelt`}
      title={`${year} izin bakiyesini düzelt`}
      description={<>{name}. Kalan = hak edilen + devreden − elle düşülen − kayıtlı yıllık izinler ({fmt(recorded)} gün).</>}
      onOpen={reset}
      onSave={() => updateLeaveBalance({ id, entitled: e, carried: c, used: u, note })}
    >
      <NumberInput
        label="Kalan izin hakkı" autoFocus
        value={leftText ?? (Number.isFinite(left) ? toField(Math.round(left * 100) / 100) : "")}
        onChange={(v) => {
          setLeftText(v);
          const want = num(v);
          // Kalan'ı yazınca Hak edilen ayarlanır: hak = kalan + elle düşülen + kayıtlı − devreden
          if (v.trim() !== "" && Number.isFinite(want)) setE(toField(Math.round((want + num(u) + recorded - num(c)) * 100) / 100));
        }}
        hint="Buraya yazarsanız “Hak edilen” buna göre ayarlanır"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberInput label="Hak edilen" value={e} onChange={(v) => { setE(v); setLeftText(null); }} />
        <NumberInput label="Devreden" value={c} onChange={(v) => { setC(v); setLeftText(null); }} />
        <NumberInput label="Elle düşülen" value={u} onChange={(v) => { setU(v); setLeftText(null); }} />
      </div>
      <p className={cn("rounded-lg px-3 py-2 text-sm", left < 0 ? "bg-danger-soft text-danger" : "bg-surface-2")}>
        Kaydedince kalan: <span className="font-semibold">{fmt(left)} gün</span>
        {num(e) < 0 && " — hak edilen eksi olamaz; elle düşüleni azaltın"}
      </p>
      <div>
        <label htmlFor={noteId} className="mb-1 block text-sm font-medium">Not (isteğe bağlı)</label>
        <input id={noteId} value={note} maxLength={200} onChange={(ev) => setNote(ev.target.value)} placeholder="Örn. sözleşmeyle +2 gün, 2025'ten devir" className={cn(inputCls, "h-10")} />
      </div>
    </EditDialog>
  );
}
