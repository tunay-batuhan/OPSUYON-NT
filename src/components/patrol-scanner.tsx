"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Keyboard, Loader2, ScanLine } from "lucide-react";
import { Card, CardHeader, EmptyState, btn, cn, inputCls } from "@/components/ui";
import { recordPatrolScan } from "@/app/actions/patrol";
import { fmtClock } from "@/lib/patrol";

export type ScanEntry = { point: string; project: string; at: string; duplicate?: boolean };
type Banner = { tone: "ok" | "dup" | "error"; title: string; detail?: string } | null;

/**
 * Devriye görevlisinin telefonu: kamerayı açar, noktadaki barkod/QR'ı okur ve kaydeder.
 * Kamera kullanılamıyorsa (izin yok / güvenli bağlantı değil) kod elle girilebilir.
 */
export function PatrolScanner({ recent }: { recent: ScanEntry[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [history, setHistory] = useState<ScanEntry[]>(recent);
  const [manual, setManual] = useState("");
  const [sending, setSending] = useState(false);

  const submit = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code || busyRef.current) return;
    // kamera aynı etiketi art arda okuyabilir: 3 sn içinde aynı kodu yok say
    if (lastRef.current.code === code && Date.now() - lastRef.current.at < 3000) return;
    lastRef.current = { code, at: Date.now() };
    busyRef.current = true;
    setSending(true);
    try {
      const res = await recordPatrolScan(code);
      if (res.ok) {
        navigator.vibrate?.(res.duplicate ? [40] : [90]);
        setBanner(
          res.duplicate
            ? { tone: "dup", title: `${res.point} zaten okutuldu`, detail: `${res.project} · ${fmtClock(res.scannedAt)}` }
            : { tone: "ok", title: `${res.point} okutuldu`, detail: `${res.project} · ${fmtClock(res.scannedAt)}` },
        );
        if (!res.duplicate) setHistory((h) => [{ point: res.point, project: res.project, at: res.scannedAt }, ...h].slice(0, 20));
        setManual("");
      } else {
        navigator.vibrate?.([60, 40, 60]);
        setBanner({ tone: "error", title: res.error });
      }
    } catch {
      setBanner({ tone: "error", title: "Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin." });
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setCameraOn(false);
  }, []);

  async function startCamera() {
    if (starting || cameraOn) return;
    setStarting(true);
    setBanner(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("insecure");
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
      const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current!, (result) => {
        if (result) void submit(result.getText());
      });
      stopRef.current = () => controls.stop();
      setCameraOn(true);
    } catch (e) {
      const insecure = e instanceof Error && e.message === "insecure";
      setBanner({
        tone: "error",
        title: insecure ? "Kamera yalnızca güvenli (https) bağlantıda açılır." : "Kamera açılamadı. Tarayıcıda kamera iznini verin ya da kodu aşağıdan elle girin.",
      });
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => () => stopRef.current?.(), []);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card>
        <CardHeader title="Barkod okut" description="Devriye noktasındaki barkod / QR etiketini kameraya tutun." />
        <div className="space-y-4 p-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900">
            <video ref={videoRef} className={cn("size-full object-cover", !cameraOn && "invisible")} playsInline muted aria-label="Kamera görüntüsü" />
            {!cameraOn && (
              <div className="absolute inset-0 grid place-items-center text-center text-white/80">
                <div className="space-y-2 px-6">
                  <ScanLine className="mx-auto size-10" aria-hidden />
                  <p className="text-sm">Kamera kapalı</p>
                </div>
              </div>
            )}
            {cameraOn && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="size-2/3 rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(2,6,23,0.35)]" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {cameraOn ? (
              <button type="button" onClick={stopCamera} className={btn("secondary", "lg", "flex-1")}>
                <CameraOff className="size-5" aria-hidden /> Kamerayı kapat
              </button>
            ) : (
              <button type="button" onClick={startCamera} disabled={starting} className={btn("primary", "lg", "flex-1")}>
                {starting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />} Kamerayı aç
              </button>
            )}
          </div>

          {banner && (
            <div
              role={banner.tone === "error" ? "alert" : "status"}
              className={cn(
                "flex items-start gap-3 rounded-xl px-4 py-3 text-sm",
                banner.tone === "ok" && "bg-success-soft text-success",
                banner.tone === "dup" && "bg-warning-soft text-warning",
                banner.tone === "error" && "bg-danger-soft text-danger",
              )}
            >
              {banner.tone === "error" || banner.tone === "dup" ? <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />}
              <div>
                <p className="font-semibold">{banner.title}</p>
                {banner.detail && <p className="opacity-90">{banner.detail}</p>}
              </div>
            </div>
          )}
          {sending && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Kaydediliyor…</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(manual);
            }}
            className="flex gap-2"
          >
            <label className="relative flex-1">
              <span className="sr-only">Barkod kodu</span>
              <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Kodu elle girin (örn. DVR-AB12CD34)"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={40}
                className={cn(inputCls, "h-11 pl-9 uppercase placeholder:normal-case")}
                aria-label="Barkod kodu"
              />
            </label>
            <button disabled={sending || manual.trim().length < 4} className={btn("secondary", "md", "h-11")}>Okut</button>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader title="Bugün okuttuklarım" description={`${history.length} kayıt`} />
        {history.length === 0 ? (
          <EmptyState title="Henüz okutma yok" description="Bir noktayı okuttuğunuzda burada görünür." />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.point}</span>
                  <span className="block truncate text-xs text-muted">{h.project}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">{fmtClock(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
