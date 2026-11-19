"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Car, Check, CheckCircle2, Clock, Loader2, LogOut, Minus, Package, PackageCheck, Phone, Plus, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { deleteLog, deliverCargo, markExit, recordCargo, recordVisitor, setApproval } from "@/app/actions/visitors";
import { cargoSchema, firstErrors, visitorSchema } from "@/lib/schemas-visitors";
import { COURIERS, hhmm, logStatus, normalizePlate, type Approval, type VisitorLog } from "@/lib/visitor-shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, btn, cn } from "@/components/ui";
import type { ActionState } from "@/lib/action-types";

export type DeskData = { inside: VisitorLog[]; pending: VisitorLog[]; cargo: VisitorLog[]; today: VisitorLog[]; destinations: string[] };

const big = "h-14 w-full rounded-xl border border-border bg-surface px-4 text-lg text-fg placeholder:text-muted/60 focus:border-brand focus:outline-none aria-[invalid=true]:border-danger";
const label = "mb-1.5 block text-sm font-semibold";

/** Sunucu işlemi + sonuç mesajı + sayfa tazeleme. */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>(null);
  const run = (fn: () => Promise<ActionState>, after?: () => void) =>
    start(async () => {
      let r: ActionState;
      try {
        r = await fn();
      } catch (e) {
        r = { error: e instanceof Error ? e.message : "İşlem tamamlanamadı." };
      }
      setResult(r);
      if (r?.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, result, setResult, run };
}

function Msg({ r }: { r: ActionState }) {
  if (!r?.message && !r?.error) return null;
  return (
    <p role={r.error ? "alert" : "status"} className={cn("rounded-xl px-4 py-3 text-base font-medium", r.error ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
      {r.error ?? r.message}
    </p>
  );
}

const APPROVALS: { value: Approval; label: string; Icon: typeof Check; on: string }[] = [
  { value: "onaylandi", label: "Onayladı", Icon: Check, on: "border-success bg-success text-white" },
  { value: "bekliyor", label: "Ulaşılamadı", Icon: Clock, on: "border-warning bg-warning text-white" },
  { value: "reddedildi", label: "Reddetti", Icon: X, on: "border-danger bg-danger text-white" },
];

/* ------------------------------------------------------------------ */
/* Ziyaretçi girişi                                                    */
/* ------------------------------------------------------------------ */
function VisitorForm({ projectId, listId }: { projectId: string; listId: string }) {
  const empty = { full_name: "", phone: "", plate: "", destination: "", approval: "" as Approval | "", note: "" };
  const [v, setV] = useState(empty);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const { pending, result, setResult, run } = useRun();
  const set = (k: keyof typeof empty, val: string) => {
    setV((o) => ({ ...o, [k]: val }));
    setErrs((e) => ({ ...e, [k]: "" }));
  };
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = visitorSchema.safeParse({ ...v, project_id: projectId });
    if (!parsed.success) {
      const f = firstErrors(parsed.error);
      setErrs(f.fields);
      setResult({ error: f.message });
      return;
    }
    run(() => recordVisitor(parsed.data), () => setV(empty));
  }
  const err = (k: string) => (errs[k] ? <span role="alert" className="mt-1 block text-sm text-danger">{errs[k]}</span> : null);
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="v-name" className={label}>Ad soyad <span className="text-danger">*</span></label>
        <input id="v-name" value={v.full_name} onChange={(e) => set("full_name", e.target.value)} autoCapitalize="words" autoComplete="off" placeholder="Örn. Ahmet Yılmaz" aria-invalid={Boolean(errs.full_name) || undefined} className={big} />
        {err("full_name")}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="v-phone" className={label}>Telefon</label>
          <input id="v-phone" value={v.phone} onChange={(e) => set("phone", e.target.value)} type="tel" inputMode="tel" autoComplete="off" placeholder="0532 123 45 67" aria-invalid={Boolean(errs.phone) || undefined} className={big} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor="v-plate" className={label}>Araç plakası</label>
          <input id="v-plate" value={v.plate} onChange={(e) => set("plate", normalizePlate(e.target.value))} autoCapitalize="characters" autoComplete="off" placeholder="Araçla geldiyse: 34ABC123" className={cn(big, "uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal")} />
        </div>
      </div>
      <div>
        <label htmlFor="v-dest" className={label}>Nereye geldi? (daire / firma) <span className="text-danger">*</span></label>
        <input id="v-dest" value={v.destination} onChange={(e) => set("destination", e.target.value)} list={listId} autoComplete="off" placeholder="Örn. A Blok 12 · Yılmaz ailesi" aria-invalid={Boolean(errs.destination) || undefined} className={big} />
        {err("destination")}
      </div>
      <fieldset>
        <legend className={label}>Daire sakini / firma ziyaretçiyi onayladı mı? <span className="text-danger">*</span></legend>
        <div className="grid grid-cols-3 gap-2">
          {APPROVALS.map((a) => {
            const on = v.approval === a.value;
            return (
              <button
                key={a.value}
                type="button"
                aria-pressed={on}
                onClick={() => set("approval", a.value)}
                className={cn("flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-sm font-bold transition-colors sm:flex-row sm:gap-2 sm:text-base", on ? a.on : "border-border bg-surface text-fg hover:bg-surface-2")}
              >
                <a.Icon className="size-5" aria-hidden /> {a.label}
              </button>
            );
          })}
        </div>
        {err("approval")}
      </fieldset>
      <div>
        <label htmlFor="v-note" className={label}>Not <span className="font-normal text-muted">(isteğe bağlı)</span></label>
        <input id="v-note" value={v.note} onChange={(e) => set("note", e.target.value)} autoComplete="off" placeholder="Örn. tadilat ustası, 2 kişi" className={big} />
      </div>
      <Msg r={result} />
      <button type="submit" disabled={pending} className={btn("primary", "lg", "h-16 w-full text-lg")}>
        {pending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <UserPlus className="size-6" aria-hidden />} Girişi kaydet
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Kargo / teslimat                                                     */
/* ------------------------------------------------------------------ */
function CargoForm({ projectId, listId }: { projectId: string; listId: string }) {
  const empty = { courier: "", other: "", destination: "", package_count: 1, full_name: "", note: "", delivered_now: false, delivered_to: "" };
  const [v, setV] = useState(empty);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const { pending, result, setResult, run } = useRun();
  const set = <K extends keyof typeof empty>(k: K, val: (typeof empty)[K]) => {
    setV((o) => ({ ...o, [k]: val }));
    setErrs((e) => ({ ...e, [k === "other" ? "courier" : k]: "" }));
  };
  const courier = v.courier === "Diğer" ? v.other.trim() : v.courier;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = cargoSchema.safeParse({ ...v, courier, project_id: projectId });
    if (!parsed.success) {
      const f = firstErrors(parsed.error);
      setErrs(f.fields);
      setResult({ error: f.message });
      return;
    }
    run(() => recordCargo(parsed.data), () => setV(empty));
  }
  const err = (k: string) => (errs[k] ? <span role="alert" className="mt-1 block text-sm text-danger">{errs[k]}</span> : null);
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className={label}>Kargo / teslimat firması <span className="text-danger">*</span></legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...COURIERS, "Diğer"].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={v.courier === c}
              onClick={() => set("courier", c)}
              className={cn("h-12 rounded-xl border-2 px-2 text-sm font-semibold transition-colors", v.courier === c ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface hover:bg-surface-2")}
            >
              {c}
            </button>
          ))}
        </div>
        {v.courier === "Diğer" && (
          <input value={v.other} onChange={(e) => set("other", e.target.value)} aria-label="Firma adı" placeholder="Firma adını yazın" autoComplete="off" className={cn(big, "mt-2")} />
        )}
        {err("courier")}
      </fieldset>
      <div>
        <label htmlFor="c-dest" className={label}>Kime? (daire / firma) <span className="text-danger">*</span></label>
        <input id="c-dest" value={v.destination} onChange={(e) => set("destination", e.target.value)} list={listId} autoComplete="off" placeholder="Örn. B Blok 7" aria-invalid={Boolean(errs.destination) || undefined} className={big} />
        {err("destination")}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className={label} id="c-count-label">Paket sayısı</span>
          <div className="flex h-14 items-center gap-2" role="group" aria-labelledby="c-count-label">
            <button type="button" onClick={() => set("package_count", Math.max(1, v.package_count - 1))} aria-label="Bir azalt" className="grid size-14 place-items-center rounded-xl border border-border bg-surface hover:bg-surface-2"><Minus className="size-5" aria-hidden /></button>
            <output aria-live="polite" className="w-14 text-center text-2xl font-bold tabular-nums">{v.package_count}</output>
            <button type="button" onClick={() => set("package_count", Math.min(99, v.package_count + 1))} aria-label="Bir artır" className="grid size-14 place-items-center rounded-xl border border-border bg-surface hover:bg-surface-2"><Plus className="size-5" aria-hidden /></button>
          </div>
        </div>
        <div>
          <label htmlFor="c-name" className={label}>Kurye adı <span className="font-normal text-muted">(isteğe bağlı)</span></label>
          <input id="c-name" value={v.full_name} onChange={(e) => set("full_name", e.target.value)} autoCapitalize="words" autoComplete="off" className={big} />
        </div>
      </div>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <input type="checkbox" checked={v.delivered_now} onChange={(e) => set("delivered_now", e.target.checked)} className="size-6 accent-[var(--brand)]" />
        <span className="text-base font-medium">Kurye doğrudan sahibine teslim etti <span className="block text-sm font-normal text-muted">İşaretlemezseniz kargo &quot;kulübede bekliyor&quot; olarak kaydedilir</span></span>
      </label>
      {v.delivered_now && (
        <div>
          <label htmlFor="c-to" className={label}>Teslim alan <span className="font-normal text-muted">(isteğe bağlı)</span></label>
          <input id="c-to" value={v.delivered_to} onChange={(e) => set("delivered_to", e.target.value)} autoCapitalize="words" autoComplete="off" className={big} />
        </div>
      )}
      <Msg r={result} />
      <button type="submit" disabled={pending} className={btn("primary", "lg", "h-16 w-full text-lg")}>
        {pending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Package className="size-6" aria-hidden />} Kargoyu kaydet
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Listeler                                                            */
/* ------------------------------------------------------------------ */
function Section({ title, count, hint, children, Icon }: { title: string; count: number; hint?: string; children: React.ReactNode; Icon: typeof Users }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-border bg-surface shadow-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="size-5 text-brand" aria-hidden />
        <h2 className="text-base font-bold">{title}</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold tabular-nums">{count}</span>
        {hint && <span className="ml-auto hidden text-xs text-muted sm:inline">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function InsideRow({ l }: { l: VisitorLog }) {
  const { pending, result, run } = useRun();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{l.full_name}</p>
        <p className="text-sm text-muted">
          {l.destination} · giriş {hhmm(l.entered_at)}
          {l.plate && <span className="ml-1 inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 font-mono text-xs text-fg"><Car className="size-3" aria-hidden />{l.plate}</span>}
        </p>
        {result?.error && <p role="alert" className="text-sm text-danger">{result.error}</p>}
      </div>
      <button type="button" disabled={pending} onClick={() => run(() => markExit({ id: l.id }))} className={btn("secondary", "lg", "h-12 shrink-0")} aria-label={`${l.full_name} çıkış yaptı`}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LogOut className="size-5" aria-hidden />} Çıkış yaptı
      </button>
    </li>
  );
}

function PendingRow({ l }: { l: VisitorLog }) {
  const { pending, result, run } = useRun();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{l.full_name}</p>
        <p className="text-sm text-muted">{l.destination} · {hhmm(l.entered_at)}{l.phone && <> · <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="text-brand-hover">{l.phone}</a></>}</p>
        {result?.error && <p role="alert" className="text-sm text-danger">{result.error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => setApproval({ id: l.id, approval: "onaylandi" }))} className={cn(btn("primary", "lg", "h-12"), "bg-success hover:bg-success")} aria-label={`${l.full_name} onaylandı`}>
          <Check className="size-5" aria-hidden /> Onayladı
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => setApproval({ id: l.id, approval: "reddedildi" }))} className={btn("danger", "lg", "h-12")} aria-label={`${l.full_name} reddedildi`}>
          <X className="size-5" aria-hidden /> Reddetti
        </button>
      </div>
    </li>
  );
}

function CargoRow({ l }: { l: VisitorLog }) {
  const { pending, result, run } = useRun();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const id = useId();
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{l.destination}</p>
          <p className="text-sm text-muted">{l.courier} · {l.package_count} paket · {hhmm(l.entered_at)}</p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "lg", "h-12 shrink-0")} aria-label={`${l.destination} kargosunu teslim et`}>
            <PackageCheck className="size-5" aria-hidden /> Teslim et
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor={id} className="mb-1 block text-sm font-medium">Teslim alan <span className="text-muted">(isteğe bağlı)</span></label>
            <input id={id} value={to} onChange={(e) => setTo(e.target.value)} autoCapitalize="words" autoComplete="off" placeholder="Ad soyad" className={cn(big, "h-12 text-base")} />
          </div>
          <button type="button" disabled={pending} onClick={() => run(() => deliverCargo({ id: l.id, delivered_to: to }))} className={btn("primary", "lg", "h-12")}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />} Teslim edildi
          </button>
          <button type="button" onClick={() => setOpen(false)} className={btn("ghost", "lg", "h-12")}>Vazgeç</button>
        </div>
      )}
      {result?.error && <p role="alert" className="mt-1 text-sm text-danger">{result.error}</p>}
    </li>
  );
}

function TodayRow({ l, canDelete }: { l: VisitorLog; canDelete: boolean }) {
  const { pending, result, run } = useRun();
  const s = logStatus(l);
  const who = l.kind === "kargo" ? `${l.courier} kargo · ${l.package_count} paket` : l.full_name;
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-muted">{hhmm(l.entered_at)}</span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted" aria-hidden>
        {l.kind === "kargo" ? <Package className="size-4" /> : <Users className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium [overflow-wrap:anywhere]">{who}</p>
        <p className="text-xs text-muted [overflow-wrap:anywhere]">
          {l.destination}
          {l.plate ? ` · ${l.plate}` : ""}
          {l.exited_at ? ` · çıkış ${hhmm(l.exited_at)}` : ""}
          {l.delivered_at ? ` · teslim ${hhmm(l.delivered_at)}${l.delivered_to ? ` (${l.delivered_to})` : ""}` : ""}
        </p>
        <span className="mt-1 inline-block"><Badge tone={s.tone}>{s.label}</Badge></span>
        {result?.error && <p role="alert" className="text-xs text-danger">{result.error}</p>}
      </div>
      {canDelete && (
        <ConfirmDialog
          title="Kayıt silinsin mi?"
          description="Yanlış girilen kaydı siler. Silme işlemi işlem geçmişinde kalır."
          items={[`${hhmm(l.entered_at)} · ${who} · ${l.destination}`]}
          confirmLabel="Sil"
          onConfirm={() => run(() => deleteLog({ id: l.id }))}
        >
          <button type="button" disabled={pending} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label={`${who} kaydını sil`}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </ConfirmDialog>
      )}
    </li>
  );
}

/**
 * Ziyaretçi defteri (tek ekran): üstte Ziyaretçi / Kargo seçimi ve büyük, az alanlı form; altında içerideki
 * ziyaretçiler (Çıkış yaptı), sakin onayı bekleyenler, kulübedeki kargolar (Teslim et) ve bugünün defteri.
 * Telefon ve kulübe tableti için; ekran dakikada bir kendiliğinden tazelenir (başka cihazdan girilen kayıtlar görünsün).
 */
export function VisitorDesk({ projectId, desk, myPersonnelId, canDeleteAny, ownDeleteSince }: {
  projectId: string; desk: DeskData; myPersonnelId: string | null; canDeleteAny: boolean;
  /** bu andan (ISO) sonra girilen kendi kayıtları silinebilir (personel) */
  ownDeleteSince: string;
}) {
  const [tab, setTab] = useState<"ziyaretci" | "kargo">("ziyaretci");
  const router = useRouter();
  const listId = useId();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => clearInterval(t);
  }, [router]);
  // personel: yalnız kendi girdiği ve 30 dakikadan yeni kayıtlar silinebilir (sunucu da denetler)
  const deletable = (l: VisitorLog) =>
    canDeleteAny || (Boolean(myPersonnelId) && l.by_personnel === myPersonnelId && l.entered_at >= ownDeleteSince);

  return (
    <div className="space-y-5">
      <datalist id={listId}>
        {desk.destinations.map((d) => <option key={d} value={d} />)}
      </datalist>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <div role="tablist" aria-label="Kayıt türü" className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1.5">
          {([["ziyaretci", "Ziyaretçi", "Ziyaretçi girişi", UserPlus], ["kargo", "Kargo", "Kargo / teslimat", Package]] as const).map(([k, short, l, Icon]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-label={l}
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("flex h-14 items-center justify-center gap-2 rounded-xl text-base font-bold transition-colors", tab === k ? "bg-[var(--navy)] text-white shadow" : "text-muted hover:text-fg")}
            >
              <Icon className="size-5" aria-hidden /> <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>
        {tab === "ziyaretci" ? <VisitorForm key={`v-${projectId}`} projectId={projectId} listId={listId} /> : <CargoForm key={`c-${projectId}`} projectId={projectId} listId={listId} />}
      </div>

      {desk.pending.length > 0 && (
        <Section title="Sakin onayı bekleyen" count={desk.pending.length} hint="Sakine ulaşınca işaretleyin" Icon={Phone}>
          <ul className="divide-y divide-border">{desk.pending.map((l) => <PendingRow key={l.id} l={l} />)}</ul>
        </Section>
      )}

      <Section title="İçerideki ziyaretçiler" count={desk.inside.length} hint="Çıkarken işaretleyin" Icon={Users}>
        {desk.inside.length ? (
          <ul className="divide-y divide-border">{desk.inside.map((l) => <InsideRow key={l.id} l={l} />)}</ul>
        ) : (
          <p className="px-4 py-5 text-sm text-muted">Şu an içeride kayıtlı ziyaretçi yok.</p>
        )}
      </Section>

      <Section title="Kulübede bekleyen kargolar" count={desk.cargo.length} hint="Sahibi alınca teslim edin" Icon={Package}>
        {desk.cargo.length ? (
          <ul className="divide-y divide-border">{desk.cargo.map((l) => <CargoRow key={l.id} l={l} />)}</ul>
        ) : (
          <p className="px-4 py-5 text-sm text-muted">Bekleyen kargo yok.</p>
        )}
      </Section>

      <Section title="Bugünün defteri" count={desk.today.length} Icon={CheckCircle2}>
        {desk.today.length ? (
          <ul className="divide-y divide-border">{desk.today.map((l) => <TodayRow key={l.id} l={l} canDelete={deletable(l)} />)}</ul>
        ) : (
          <p className="px-4 py-5 text-sm text-muted">Bugün henüz kayıt yok.</p>
        )}
      </Section>
    </div>
  );
}
