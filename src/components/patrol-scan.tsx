"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, CircleDot, Flag, Loader2, MapPin, MapPinOff, Play, Repeat, Search, UserRound } from "lucide-react";
import { btn, cn, inputCls } from "@/components/ui";
import { checkPatrolPin } from "@/app/actions/patrol";
import { tourEnd, tourResume, tourScan, tourStart, type ScanLocation, type TourInfo, type TourResult } from "@/app/actions/patrol-tour";
import { fmtClock } from "@/lib/patrol";

type Person = { id: string; name: string };
const LAST_KEY = "opsuyon:devriye:son";
const CONNECTION = "Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.";

/**
 * Konum isteğe bağlıdır: izin verilmezse ya da süre dolunca kayıt eldekiyle (ya da konumsuz) yapılır.
 * Telefon önce kaba (Wi-Fi/baz) konum verir, GPS birkaç saniyede oturur: `waitMs` boyunca gelenlerin en
 * isabetlisi alınır; `goodM` metre ya da daha iyisi gelirse beklenmez.
 */
function getLocation(waitMs: number, goodM: number): Promise<ScanLocation> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let best: ScanLocation = null;
    let watch: number | null = null;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watch != null) navigator.geolocation.clearWatch(watch);
      resolve(best);
    };
    const timer = setTimeout(finish, waitMs);
    try {
      watch = navigator.geolocation.watchPosition(
        (p) => {
          const accuracy = Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null;
          if (!best || best.accuracy == null || (accuracy != null && accuracy < best.accuracy)) best = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy };
          if (accuracy != null && accuracy <= goodM) finish();
        },
        (e) => {
          if (e.code === e.PERMISSION_DENIED) finish(); // izin yok: beklemeye gerek yok
        },
        { enableHighAccuracy: true, timeout: waitMs, maximumAge: 0 },
      );
    } catch {
      finish();
    }
  });
}
/** Tur başlatma / bitirme: konum için biraz daha beklenir. Nokta okutmada görevli yürüyüştedir: kısa tutulur. */
const locSlow = () => getLocation(8000, 15);
const locFast = () => getLocation(4000, 25);

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

const minutesBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
const duration = (min: number) => (min < 60 ? `${min} dk` : `${Math.floor(min / 60)} sa ${min % 60} dk`);

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{children}</span>
    </p>
  );
}

/** "3 / 8 nokta" çubuğu + kalan noktaların adları */
function Progress({ tour, title = "Kalan noktalar" }: { tour: TourInfo; title?: string }) {
  const total = tour.done + tour.missing.length;
  const pct = total ? Math.round((tour.done / total) * 100) : 100;
  return (
    <div className="mt-4 text-left">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{tour.done} / {total} nokta okutuldu</span>
        <span className="text-xs text-muted">{tour.person}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={tour.done}>
        <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {tour.missing.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{title} ({tour.missing.length})</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {tour.missing.map((m) => (
              <li key={m} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs">{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Proje PIN'i → personel listesinden ad. Yalnızca tur BAŞLATILIRKEN (ve projede birden fazla açık devriye varken
 * noktanın kimin devriyesine yazılacağını seçmek için) sorulur; nokta okutmalarında sorulmaz. Son seçilen ad bu telefonda hatırlanır.
 */
function PinAndName({
  code, busy, onPick, onBack, error, setError,
}: {
  code: string; busy: boolean; onPick: (pin: string, person: Person) => void; onBack?: () => void;
  error: string | null; setError: (e: string | null) => void;
}) {
  const [pin, setPin] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [filter, setFilter] = useState("");
  const [checking, setChecking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
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
    if (checking || !/^\d{4}$/.test(pin)) return;
    setChecking(true);
    setError(null);
    try {
      const res = await checkPatrolPin(code, pin);
      if (res.ok) {
        if (res.people.length === 0) setError("Bu projede bugün görevli personel bulunamadı. Merkez ile iletişime geçin.");
        else setPeople(res.people);
      } else {
        navigator.vibrate?.([60, 40, 60]);
        setError(res.error);
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError(CONNECTION);
    } finally {
      setChecking(false);
    }
  }

  if (people) {
    return (
      <div className="mt-5 space-y-3">
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
        {error && <ErrorBox>{error}</ErrorBox>}
        <ul className="space-y-2">
          {ordered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => { setPicked(p.id); writeLast(p.id); onPick(pin, p); }}
                disabled={busy}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-base font-medium transition-colors disabled:opacity-60",
                  p.id === last ? "border-brand bg-brand-soft" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                {busy && picked === p.id ? <Loader2 className="size-5 shrink-0 animate-spin text-brand" aria-hidden /> : <UserRound className="size-5 shrink-0 text-muted" aria-hidden />}
                <span className="flex-1">{p.name}</span>
                {p.id === last && <span className="text-xs font-normal text-brand">Son seçiminiz</span>}
              </button>
            </li>
          ))}
          {ordered.length === 0 && <li className="py-4 text-center text-sm text-muted">Bu adla personel yok.</li>}
        </ul>
        {busy && <p className="text-center text-xs text-muted" role="status">Konum alınıyor, birkaç saniye sürebilir…</p>}
      </div>
    );
  }

  return (
    <form onSubmit={sendPin} className="mt-5 space-y-4">
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
        <span id="pin-help" className="mt-1.5 block text-xs text-muted">Merkezin verdiği 4 haneli PIN. Sonra listeden adınızı seçeceksiniz; noktalarda tekrar sorulmaz.</span>
      </label>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="submit" disabled={checking || pin.length !== 4} className={cn(btn("primary", "md"), "h-12 w-full text-base")}>
        {checking ? <><Loader2 className="size-5 animate-spin" aria-hidden /> Kontrol ediliyor…</> : "Devam"}
      </button>
      {onBack && (
        <button type="button" onClick={onBack} className="mx-auto flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft className="size-4" aria-hidden /> Geri
        </button>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Tur anahtarı: çerezin yanında telefonun yerel hafızasında da durur  */
/* ------------------------------------------------------------------ */
const TOKEN_KEY = "opsuyon:devriye:anahtar";
const TOKEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;
function readStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { token?: string; at?: number };
    if (!v.token || !v.at || Date.now() - v.at > TOKEN_MAX_AGE_MS) return null;
    return v.token;
  } catch {
    return null;
  }
}
function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, at: Date.now() }));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* saklanamazsa çerez ve sunucudaki "tek açık tur" kuralı yeter */
  }
}

/**
 * QR etiketinin açtığı ekran (devriye turu). Görevli her QR'ı telefonunun kendi kamerasıyla okutur:
 *  - "Devriye başlat / bitir" etiketi: tur yoksa PIN + ad → başlar; tur açıksa durum + "Devriyeyi bitir" düğmesi
 *    (kendiliğinden bitmez: yanlışlıkla iki kez okutma turu kapatmaz).
 *  - Nokta etiketi: tur bulunursa (telefonun anahtarı ya da projedeki TEK açık tur) hiçbir şey sormadan kaydeder;
 *    projede birden fazla açık tur varsa PIN + adla seçilir; açık tur yoksa kaydetmez ("önce başlatın").
 */
export function PatrolScan({ code, kind, point, project }: { code: string; kind: "nokta" | "tur"; point: string; project: string | null }) {
  const [res, setRes] = useState<TourResult | null>(null);
  const [located, setLocated] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState(false); // birden fazla açık tur → PIN + ad ile seç
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [newTour, setNewTour] = useState(false); // "bu devriye benim değil" → yeni devriye başlat
  const token = useRef<string | null>(null);
  const sent = useRef(false);

  const remember = (r: TourResult) => {
    if (!r.ok) return;
    if ("token" in r && r.token) {
      token.current = r.token;
      storeToken(r.token);
    }
    if (r.state === "ended") {
      token.current = null;
      storeToken(null);
    }
  };

  /** Sayfa açılınca: nokta ise (kısa konum beklemesiyle) kaydet; başlat/bitir ise durumu sor. */
  const scan = useCallback(async () => {
    setRes(null);
    setError(null);
    setResume(false);
    setConfirmEnd(false);
    setNewTour(false);
    try {
      const loc = kind === "tur" ? null : await locFast();
      const r = await tourScan(code, loc, token.current);
      if (r.ok && r.state === "scanned") {
        setLocated(Boolean(loc));
        navigator.vibrate?.([90]);
      }
      if (r.ok && r.state === "no_tour") navigator.vibrate?.([60, 40, 60]);
      remember(r);
      setRes(r);
    } catch {
      setRes({ ok: false, error: CONNECTION });
    }
  }, [code, kind]);

  useEffect(() => {
    if (sent.current) return; // geliştirmede çift çalışmaya karşı
    sent.current = true;
    token.current = readStoredToken();
    void scan();
  }, [scan]);

  async function run(action: (loc: ScanLocation) => Promise<TourResult>, locate: () => Promise<ScanLocation>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const loc = await locate();
      const r = await action(loc);
      if (r.ok) {
        navigator.vibrate?.([90]);
        setLocated(Boolean(loc));
        setResume(false);
        setConfirmEnd(false);
        setNewTour(false);
        remember(r);
        setRes(r);
      } else {
        navigator.vibrate?.([60, 40, 60]);
        setError(r.error);
      }
    } catch {
      setError(CONNECTION);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {kind === "tur" ? <><Repeat className="size-3.5" aria-hidden /> Devriye turu</> : <><MapPin className="size-3.5" aria-hidden /> Devriye noktası</>}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{point}</h1>
      {project && <p className="mt-0.5 text-sm text-muted">{project}</p>}
    </>
  );

  const noLoc = !located && (
    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
      <MapPinOff className="size-3.5" aria-hidden /> Konum alınamadı; kayıt konumsuz yapıldı.
    </p>
  );

  const startForm = (note: ReactNode, onBack?: () => void) => (
    <div className="mt-5">
      <p className="flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm text-brand">
        <Play className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{note}</span>
      </p>
      <PinAndName code={code} busy={busy} error={error} setError={setError} onBack={onBack} onPick={(pin, p) => void run((loc) => tourStart(code, pin, p.id, loc), locSlow)} />
    </div>
  );

  const body = (() => {
    if (!res) {
      return (
        <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center" role="status">
          <Loader2 className="size-10 animate-spin text-brand" aria-hidden />
          <p className="text-sm text-muted">{kind === "nokta" ? "Okutma kaydediliyor…" : "Devriye durumu alınıyor…"}</p>
        </div>
      );
    }

    if (!res.ok) {
      return (
        <div className="mt-6 space-y-4">
          <ErrorBox>{res.error}</ErrorBox>
          <button type="button" onClick={() => void scan()} className={cn(btn("secondary", "md"), "h-12 w-full")}>Tekrar dene</button>
        </div>
      );
    }

    // --- Projede birden fazla açık devriye: PIN + ad ile kendi devriyesini seç ---
    if (resume) {
      return (
        <div className="mt-5">
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted">PIN ve adınızla devam edin; bu nokta sizin devriyenize kaydedilir.</p>
          <PinAndName
            code={code} busy={busy} error={error} setError={setError}
            onBack={() => { setResume(false); setError(null); }}
            onPick={(pin, p) => void run((loc) => tourResume(code, pin, p.id, loc), locFast)}
          />
        </div>
      );
    }

    switch (res.state) {
      // --- Başlat / bitir etiketi, tur bulunamadı: PIN + ad → başlat (kişinin açık turu varsa ona devam) ---
      case "start":
        return startForm(
          res.openTours > 0
            ? `Bu projede şu an ${res.openTours} devriye sürüyor. Kendi devriyenize devam etmek ya da yeni devriye başlatmak için PIN'i girip adınızı seçin.`
            : "Devriyeyi başlatmak için PIN'i girip adınızı seçin. Sonra noktalardaki QR kodlarını telefonunuzun kamerasıyla okutun.",
        );

      case "started":
        return (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-success-soft p-5 text-center" role="status">
              <Play className="mx-auto size-12 text-success" aria-hidden />
              <p className="mt-3 text-lg font-semibold">Devriye başladı</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{fmtClock(res.scannedAt)}</p>
              <p className="mt-2 text-sm">{res.tour.person}</p>
              {noLoc}
              <Progress tour={res.tour} title="Okutulacak noktalar" />
            </div>
            <p className="text-center text-sm text-muted">
              Şimdi noktalardaki QR kodlarını telefonunuzun kamerasıyla okutun (sıra serbest). Bitirirken bu QR&apos;ı tekrar okutun.
            </p>
          </div>
        );

      // --- Nokta okutuldu ama tur bulunamadı: kayıt yapılmadı ---
      case "no_tour":
        if (res.openTours > 0) {
          return (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-warning-soft p-5 text-center" role="alert">
                <UserRound className="mx-auto size-12 text-warning" aria-hidden />
                <p className="mt-3 text-lg font-semibold">Hangi devriye?</p>
                <p className="mt-1 text-sm">
                  Bu projede şu an {res.openTours} devriye sürüyor. Bu nokta henüz <strong className="font-semibold">kaydedilmedi</strong>; PIN ve adınızla kendi devriyenize kaydedin.
                </p>
              </div>
              <button type="button" onClick={() => { setResume(true); setError(null); }} className={cn(btn("primary", "md"), "h-12 w-full text-base")}>
                PIN ve adımla kaydet
              </button>
            </div>
          );
        }
        return (
          <div className="rounded-xl bg-warning-soft p-5 text-center mt-6" role="alert">
            <AlertTriangle className="mx-auto size-12 text-warning" aria-hidden />
            <p className="mt-3 text-lg font-semibold">Devriye başlatılmamış</p>
            <p className="mt-1 text-sm">
              Bu nokta <strong className="font-semibold">kaydedilmedi</strong>. Önce <strong className="font-semibold">“Devriye başlat / bitir”</strong> QR kodunu okutup devriyeyi başlatın.
            </p>
            <p className="mt-2 text-xs text-muted">1 saatten uzun okutma yapılmadıysa devriye kendiliğinden kapanmış olabilir.</p>
          </div>
        );

      // --- Nokta kaydedildi ---
      case "scanned": {
        const allDone = res.tour.missing.length === 0;
        return (
          <div className="mt-6 rounded-xl bg-success-soft p-5 text-center" role="status">
            <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
            <p className="mt-3 text-lg font-semibold">{res.duplicate ? "Zaten kaydedildi" : "Nokta okutuldu"}</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{fmtClock(res.scannedAt)}</p>
            {res.repeat && !res.duplicate && <p className="mt-2 text-xs text-muted">Bu nokta bu turda daha önce de okutulmuştu; yeniden kaydedildi.</p>}
            {noLoc}
            <Progress tour={res.tour} />
            <p className="mt-4 text-sm font-medium">
              {allDone
                ? <>Tüm noktalar okutuldu. Şimdi <strong className="font-semibold">“Devriye başlat / bitir”</strong> QR kodunu okutup devriyeyi bitirin.</>
                : "Sonraki noktanın QR kodunu okutun."}
            </p>
          </div>
        );
      }

      // --- Başlat / bitir etiketi, tur açık: durum + bitir (kendiliğinden bitmez) ---
      case "active": {
        if (newTour) {
          return startForm("Yeni devriye başlatmak için PIN'i girip adınızı seçin. Açık olan diğer devriye kapanmaz.", () => { setNewTour(false); setError(null); });
        }
        const missing = res.tour.missing.length;
        const end = () => void run((loc) => tourEnd(code, res.tourId, loc, token.current), locSlow);
        return (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl bg-brand-soft p-5 text-center" role="status">
              <CircleDot className="mx-auto size-10 text-brand" aria-hidden />
              <p className="mt-3 text-lg font-semibold">Devriye devam ediyor</p>
              <p className="mt-1 text-sm text-muted">Başlangıç {fmtClock(res.tour.startedAt, false)} · {duration(minutesBetween(res.tour.startedAt, new Date().toISOString()))}</p>
              <Progress tour={res.tour} title="Okutulmayan noktalar" />
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            {confirmEnd ? (
              <div className="rounded-xl border border-warning/40 bg-warning-soft p-4">
                <p className="text-sm font-medium">{missing} nokta okutulmadı. Devriye yine de bitirilsin mi?</p>
                <p className="mt-0.5 text-xs text-muted">Okutulmayan noktalar raporda “atlandı” olarak görünür.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirmEnd(false)} className={cn(btn("secondary", "md"), "h-12")}>Vazgeç</button>
                  <button type="button" disabled={busy} onClick={end} className={cn(btn("danger", "md"), "h-12")}>
                    {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Flag className="size-5" aria-hidden />} Yine de bitir
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => (missing > 0 ? setConfirmEnd(true) : end())} className={cn(btn("primary", "md"), "h-14 w-full text-base")}>
                  {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Flag className="size-5" aria-hidden />} Devriyeyi bitir
                </button>
                <p className="text-center text-sm text-muted">Devam edecekseniz bu sayfayı kapatıp noktaları okutmaya devam edin.</p>
              </>
            )}
            {busy && <p className="text-center text-xs text-muted" role="status">Konum alınıyor, birkaç saniye sürebilir…</p>}
            {!res.mine && !busy && (
              <p className="border-t border-border pt-3 text-center text-sm text-muted">
                Bu devriye <strong className="font-semibold text-fg">{res.tour.person}</strong> adına.{" "}
                <button type="button" onClick={() => { setNewTour(true); setError(null); }} className="font-medium text-brand underline-offset-2 hover:underline">
                  Siz başka biriyseniz yeni devriye başlatın
                </button>
              </p>
            )}
          </div>
        );
      }

      case "ended": {
        const missing = res.tour.missing.length;
        return (
          <div className={cn("mt-6 rounded-xl p-5 text-center", missing ? "bg-warning-soft" : "bg-success-soft")} role="status">
            <Flag className={cn("mx-auto size-12", missing ? "text-warning" : "text-success")} aria-hidden />
            <p className="mt-3 text-lg font-semibold">{missing ? "Devriye bitti — eksik nokta var" : "Devriye tamamlandı"}</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{fmtClock(res.scannedAt)}</p>
            <p className="mt-2 text-sm">{res.tour.person} · süre {duration(minutesBetween(res.tour.startedAt, res.tour.endedAt ?? res.scannedAt))}</p>
            {noLoc}
            <Progress tour={res.tour} title="Atlanan noktalar" />
            <p className="mt-4 text-sm text-muted">{missing ? "Atlanan noktalar raporda görünür." : "Tüm noktalar okutuldu. Kolay gelsin."}</p>
          </div>
        );
      }
    }
  })();

  return (
    <>
      {header}
      {body}
    </>
  );
}
