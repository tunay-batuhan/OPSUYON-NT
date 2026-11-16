"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calendar, Camera, CheckCircle2, Hourglass, Loader2, MapPin, ThumbsUp, X } from "lucide-react";
import { respondTask } from "@/app/actions/tasks";
import { TASK_FILE_ACCEPT } from "@/lib/schemas-tasks";
import { uploadTaskFile } from "@/components/tasks/upload";
import { cn } from "@/components/ui";

export type PortalTask = {
  id: string;
  title: string;
  job: string | null;
  description: string | null;
  location: string | null;
  planned_date: string | null;
  planned_time: string | null;
  status: string;
  issue_note: string | null;
  finished_by_personnel_at: string | null;
  finish_note: string | null;
  project: string | null;
};

const dateLabel = (d: string) =>
  new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));

const bigBtn = "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition disabled:opacity-60";

/**
 * Personelin görev kartı (telefon). Bekleyen görevde "Kabul et" / "Sorun var"; kabul edilen görevde "İşi bitirdim" ve
 * "Sorun var". Sorun ve iş bitimi ekranında not + isteğe bağlı fotoğraf (kamera açılır).
 */
export function PersonnelTaskCard({ task, files }: { task: PortalTask; files?: ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "issue" | "finish">(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const finishedByMe = Boolean(task.finished_by_personnel_at);
  const tone =
    task.status === "pending" ? "border-warning/50" : task.status === "issue" ? "border-danger/40" : task.status === "done" ? "border-success/30 opacity-90" : "border-brand/30";

  const send = (action: "accept" | "issue" | "finish") =>
    start(async () => {
      setError(null);
      if (action === "issue" && note.trim().length < 3) {
        setError("Lütfen sorunu kısaca yazın.");
        return;
      }
      const failed: string[] = [];
      for (const f of photos) {
        try {
          await uploadTaskFile(task.id, f, action === "finish" ? "finish" : "issue");
        } catch (e) {
          failed.push(e instanceof Error ? e.message : f.name);
        }
      }
      const res = await respondTask({ id: task.id, action, note: note.trim() || undefined });
      if (!res?.ok) {
        setError(res?.error ?? "İşlem yapılamadı. Tekrar deneyin.");
        return;
      }
      setDone(res.message ?? null);
      if (failed.length) setError(`Bazı fotoğraflar yüklenemedi: ${failed.join(" · ")}`);
      setMode(null);
      setNote("");
      setPhotos([]);
      router.refresh();
    });

  return (
    <article className={cn("overflow-hidden rounded-2xl border-2 bg-surface shadow-card", tone)}>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-snug">{task.title}</h3>
            {(task.job || task.project) && <p className="mt-0.5 text-sm text-muted">{[task.job, task.project].filter(Boolean).join(" · ")}</p>}
          </div>
          <StatusChip status={task.status} finished={finishedByMe} />
        </div>

        <ul className="space-y-1.5 text-[15px]">
          <li className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0 text-brand" aria-hidden />
            {task.planned_date ? (
              <span className="font-semibold">
                {dateLabel(task.planned_date)}
                {task.planned_time ? ` · ${task.planned_time.slice(0, 5)}` : ""}
              </span>
            ) : (
              <span className="text-muted">Tarih henüz verilmedi</span>
            )}
          </li>
          {task.location && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-brand" aria-hidden /> {task.location}
            </li>
          )}
        </ul>

        {task.description && <p className="whitespace-pre-line rounded-xl bg-surface-2 px-3 py-2.5 text-[15px] leading-relaxed">{task.description}</p>}
        {files}

        {task.status === "issue" && task.issue_note && (
          <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <span className="font-semibold">Bildirdiğiniz sorun:</span> {task.issue_note}
            <span className="mt-1 block text-xs text-fg/70">Müdürünüz inceliyor. Düzeltilince görev size yeniden gelir.</span>
          </p>
        )}
        {finishedByMe && task.status === "accepted" && (
          <p className="rounded-xl bg-success-soft px-3 py-2.5 text-sm text-success">
            İşi bitirdiğinizi bildirdiniz; müdürünüzün onayı bekleniyor.{task.finish_note ? ` Notunuz: ${task.finish_note}` : ""}
          </p>
        )}
        {done && <p role="status" className="rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium text-success">{done}</p>}
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
      </div>

      {mode ? (
        <div className="space-y-3 border-t border-border bg-surface-2/60 p-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">{mode === "issue" ? "Sorun nedir?" : "Not (isteğe bağlı)"}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder={mode === "issue" ? "Örn. Asansör arızalı, giriş kapalı." : "Örn. Temizlik bitti, fotoğraf ekledim."}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <div>
            <input
              ref={input}
              type="file"
              accept={TASK_FILE_ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                // dosyalar kutu temizlenmeden ÖNCE kopyalanır (durum güncellemesi sonradan çalışır)
                const picked = Array.from(e.target.files ?? []);
                setPhotos((cur) => [...cur, ...picked].slice(0, 6));
                if (input.current) input.current.value = "";
              }}
            />
            <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold">
              <Camera className="size-5 text-brand" aria-hidden /> Fotoğraf ekle
            </button>
            {photos.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {photos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setPhotos((cur) => cur.filter((_, j) => j !== i))} aria-label={`${f.name} çıkar`} className="text-muted">
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => { setMode(null); setError(null); }} className={cn(bigBtn, "flex-none border border-border bg-surface px-5")}>
              Vazgeç
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => send(mode)}
              className={cn(bigBtn, mode === "issue" ? "bg-danger text-white" : "bg-success text-white")}
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : mode === "issue" ? <AlertTriangle className="size-5" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
              {mode === "issue" ? "Sorunu gönder" : "İşi bitirdim"}
            </button>
          </div>
        </div>
      ) : (
        <Actions task={task} pending={pending} finished={finishedByMe} onAccept={() => send("accept")} onMode={setMode} />
      )}
    </article>
  );
}

function Actions({
  task, pending, finished, onAccept, onMode,
}: { task: PortalTask; pending: boolean; finished: boolean; onAccept: () => void; onMode: (m: "issue" | "finish") => void }) {
  if (task.status === "pending" || task.status === "issue") {
    return (
      <div className="flex gap-2 border-t border-border p-4">
        <button type="button" disabled={pending} onClick={onAccept} className={cn(bigBtn, "bg-success text-white")}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ThumbsUp className="size-5" aria-hidden />} Kabul et
        </button>
        <button type="button" disabled={pending} onClick={() => onMode("issue")} className={cn(bigBtn, "border-2 border-danger/40 bg-surface text-danger")}>
          <AlertTriangle className="size-5" aria-hidden /> {task.status === "issue" ? "Açıklamayı güncelle" : "Sorun var"}
        </button>
      </div>
    );
  }
  if (task.status === "accepted" && !finished) {
    return (
      <div className="flex gap-2 border-t border-border p-4">
        <button type="button" disabled={pending} onClick={() => onMode("finish")} className={cn(bigBtn, "bg-success text-white")}>
          <CheckCircle2 className="size-5" aria-hidden /> İşi bitirdim
        </button>
        <button type="button" disabled={pending} onClick={() => onMode("issue")} className={cn(bigBtn, "flex-none border-2 border-danger/40 bg-surface px-4 text-danger")}>
          <AlertTriangle className="size-5" aria-hidden /> Sorun var
        </button>
      </div>
    );
  }
  return null;
}

function StatusChip({ status, finished }: { status: string; finished: boolean }) {
  const map: Record<string, [string, string]> = {
    pending: ["Yanıtınızı bekliyor", "bg-warning-soft text-warning"],
    issue: ["Sorun bildirdiniz", "bg-danger-soft text-danger"],
    accepted: finished ? ["Onay bekleniyor", "bg-success-soft text-success"] : ["Kabul ettiniz", "bg-brand-soft text-brand"],
    done: ["Tamamlandı", "bg-success-soft text-success"],
  };
  const [label, cls] = map[status] ?? ["—", "bg-surface-2 text-muted"];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", cls)}>
      {status === "pending" && <Hourglass className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}
