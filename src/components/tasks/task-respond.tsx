"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Paperclip, ThumbsUp, X } from "lucide-react";
import { respondTask } from "@/app/actions/tasks";
import { TASK_FILE_ACCEPT } from "@/lib/schemas-tasks";
import { uploadTaskFile } from "@/components/tasks/upload";
import { btn, cn, textareaCls } from "@/components/ui";

const solid = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50";
const green = cn(solid, "bg-success");
const red = cn(solid, "bg-danger");

/**
 * Merkez görevinde görevin atandığı kullanıcının yanıtı (görev sayfasında): bekleyen görevde "Kabul et" / "Sorun var";
 * kabul edilen görevde "İşi bitirdim" / "Sorun var". Sorun ve iş bitiminde not + isteğe bağlı dosya.
 * (Saha personelinin telefon ekranındaki kartın masaüstü karşılığı; kurallar aynı: public.task_respond.)
 */
export function TaskRespond({ id, status, finished }: { id: string; status: string; finished: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "issue" | "finish">(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const send = (action: "accept" | "issue" | "finish") =>
    start(async () => {
      setError(null);
      setDone(null);
      if (action === "issue" && note.trim().length < 3) {
        setError("Lütfen sorunu kısaca yazın.");
        return;
      }
      const failed: string[] = [];
      for (const f of files) {
        try {
          await uploadTaskFile(id, f, action === "finish" ? "finish" : "issue");
        } catch (e) {
          failed.push(e instanceof Error ? e.message : f.name);
        }
      }
      const res = await respondTask({ id, action, note: note.trim() || undefined });
      if (!res?.ok) {
        setError(res?.error ?? "İşlem yapılamadı. Tekrar deneyin.");
        return;
      }
      setDone(res.message ?? null);
      if (failed.length) setError(`Bazı dosyalar yüklenemedi: ${failed.join(" · ")}`);
      setMode(null);
      setNote("");
      setFiles([]);
      router.refresh();
    });

  const canAccept = status === "pending" || status === "issue";
  const canFinish = status === "accepted" && !finished;
  const canIssue = canAccept || canFinish;

  return (
    <div className="space-y-3">
      {status === "accepted" && finished && <p className="text-sm text-success">İşi bitirdiğinizi bildirdiniz; görevi verenin onayı bekleniyor.</p>}
      {status === "issue" && !mode && <p className="text-sm text-muted">Sorun bildirdiniz. Görev düzeltilince size yeniden gelir; isterseniz şimdi kabul edebilir ya da açıklamayı güncelleyebilirsiniz.</p>}
      {done && <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">{done}</p>}
      {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {mode ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{mode === "issue" ? "Sorun nedir?" : "Not (isteğe bağlı)"}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder={mode === "issue" ? "Örn. Bu iş için gerekli bilgi bende yok." : "Örn. Rapor hazırlandı, ekte."}
              className={textareaCls}
            />
          </label>
          <div>
            <input
              ref={input}
              type="file"
              accept={TASK_FILE_ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                // dosyalar kutu temizlenmeden ÖNCE kopyalanır (durum güncellemesi sonradan çalışır)
                const picked = Array.from(e.target.files ?? []);
                setFiles((cur) => [...cur, ...picked].slice(0, 6));
                if (input.current) input.current.value = "";
              }}
            />
            <button type="button" onClick={() => input.current?.click()} className={btn("secondary", "sm")}>
              <Paperclip className="size-4" aria-hidden /> Fotoğraf / PDF ekle
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={`${f.name} dosyasını çıkar`} className="text-muted hover:text-danger">
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => send(mode)} className={mode === "issue" ? red : green}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : mode === "issue" ? <AlertTriangle className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
              {mode === "issue" ? "Sorunu gönder" : "İşi bitirdim"}
            </button>
            <button type="button" disabled={pending} onClick={() => { setMode(null); setError(null); }} className={btn("ghost", "md")}>
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        (canAccept || canIssue) && (
          <div className="flex flex-wrap gap-2">
            {canAccept && (
              <button type="button" disabled={pending} onClick={() => send("accept")} className={green}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ThumbsUp className="size-4" aria-hidden />} Kabul et
              </button>
            )}
            {canFinish && (
              <button type="button" disabled={pending} onClick={() => setMode("finish")} className={green}>
                <CheckCircle2 className="size-4" aria-hidden /> İşi bitirdim
              </button>
            )}
            {canIssue && (
              <button type="button" disabled={pending} onClick={() => setMode("issue")} className={btn("secondary", "md", "text-danger")}>
                <AlertTriangle className="size-4" aria-hidden /> {status === "issue" ? "Açıklamayı güncelle" : "Sorun var"}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
