"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2, MapPinOff, Search, UserRound } from "lucide-react";
import { btn, cn, inputCls } from "@/components/ui";
import { checkPatrolPin, submitPatrolScan, type ScanLocation, type ScanResult } from "@/app/actions/patrol";
import { fmtClock } from "@/lib/patrol";

type Person = { id: string; name: string };
const LAST_KEY = "opsuyon:devriye:son";

/** Konum isteğe bağlıdır: izin verilmezse ya da 6 sn içinde gelmezse kayıt konumsuz yapılır. */
function getLocation(): Promise<ScanLocation> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const done = (v: ScanLocation) => {
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null }),
      () => done(null),
      { enableHighAccuracy: true, timeout: 5500, maximumAge: 30000 },
    );
  });
}

const readLast = () => {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};
const writeLast = (id: string) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* kolaylık: saklanamazsa sorun değil */
  }
};

/**
 * Devriye noktası: 1) projenin 4 haneli PIN'i, 2) personel listesinden kendi adını seçer → kayıt.
 * Son seçilen ad (yalnızca kolaylık için) bu telefonda hatırlanır ve listenin başında gösterilir.
 */
export function PatrolPinForm({ code }: { code: string }) {
  const [pin, setPin] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "pin" ya da seçilen kişinin id'si
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(Extract<ScanResult, { ok: true }> & { located: boolean }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [last] = useState(readLast);

  const ordered = useMemo(() => {
    if (!people) return [];
    const q = filter.trim().toLocaleLowerCase("tr");
    const list = q ? people.filter((p) => p.name.toLocaleLowerCase("tr").includes(q)) : people;
    const mine = list.find((p) => p.id === last);
    return mine ? [mine, ...list.filter((p) => p !== mine)] : list;
  }, [people, filter, last]);

  async function sendPin(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !/^\d{4}$/.test(pin)) return;
    setBusy("pin");
    setError(null);
    try {
      const res = await checkPatrolPin(code, pin);
      if (res.ok) {
        if (res.people.length === 0) setError("Bu projede kayıtlı personel bulunamadı. Merkez ile iletişime geçin.");
        else setPeople(res.people);
      } else {
        navigator.vibrate?.([60, 40, 60]);
        setError(res.error);
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.");
    } finally {
      setBusy(null);
    }
  }

  async function choose(p: Person) {
    if (busy) return;
    setBusy(p.id);
    setError(null);
    try {
      const loc = await getLocation();
      const res = await submitPatrolScan(code, pin, p.id, loc);
      if (res.ok) {
        writeLast(p.id);
        navigator.vibrate?.([90]);
        setResult({ ...res, located: Boolean(loc) });
      } else {
        navigator.vibrate?.([60, 40, 60]);
        setError(res.error);
      }
    } catch {
      setError("Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.");
    } finally {
      setBusy(null);
    }
  }

  const errorBox = error && (
    <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
    </p>
  );

  if (result) {
    return (
      <div className="mt-6 rounded-xl bg-success-soft p-5 text-center" role="status">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <p className="mt-3 text-lg font-semibold">{result.duplicate ? "Zaten kaydedildi" : "Devriye kaydedildi"}</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{fmtClock(result.scannedAt)}</p>
        <p className="mt-2 text-sm">{result.person}</p>
        {!result.located && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
            <MapPinOff className="size-3.5" aria-hidden /> Konum alınamadı; kayıt konumsuz yapıldı.
          </p>
        )}
        <p className="mt-4 text-sm text-muted">Sonraki noktadaki QR kodu okutun.</p>
      </div>
    );
  }

  if (people) {
    return (
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Adınızı seçin</p>
          <button type="button" onClick={() => { setPeople(null); setPin(""); setError(null); setFilter(""); }} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> PIN
          </button>
        </div>
        {people.length > 8 && (
          <label className="relative block">
            <span className="sr-only">Ad ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Adınızı yazın…" autoComplete="off" className={cn(inputCls, "pl-9")} />
          </label>
        )}
        {errorBox}
        <ul className="space-y-2">
          {ordered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => choose(p)}
                disabled={busy !== null}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-base font-medium transition-colors disabled:opacity-60",
                  p.id === last ? "border-brand bg-brand-soft" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                {busy === p.id ? <Loader2 className="size-5 shrink-0 animate-spin text-brand" aria-hidden /> : <UserRound className="size-5 shrink-0 text-muted" aria-hidden />}
                <span className="flex-1">{p.name}</span>
                {p.id === last && <span className="text-xs font-normal text-brand">Son seçiminiz</span>}
              </button>
            </li>
          ))}
          {ordered.length === 0 && <li className="py-4 text-center text-sm text-muted">Bu adla personel yok.</li>}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={sendPin} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Proje PIN kodu</span>
        <input
          ref={inputRef}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          pattern="[0-9]{4}"
          autoComplete="off"
          autoFocus
          maxLength={4}
          placeholder="••••"
          aria-describedby="pin-help"
          className={cn(inputCls, "h-16 text-center text-3xl tracking-[0.6em] tabular-nums")}
        />
        <span id="pin-help" className="mt-1.5 block text-xs text-muted">Merkezin size verdiği 4 haneli PIN. Sonra listeden adınızı seçeceksiniz.</span>
      </label>
      {errorBox}
      <button type="submit" disabled={busy !== null || pin.length !== 4} className={cn(btn("primary", "md"), "h-12 w-full text-base")}>
        {busy ? <><Loader2 className="size-5 animate-spin" aria-hidden /> Kontrol ediliyor…</> : "Devam"}
      </button>
    </form>
  );
}
