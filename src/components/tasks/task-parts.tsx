import { FileText } from "lucide-react";
import { cn } from "@/components/ui";
import { eventLabel, FILE_STAGE_LABELS, isImageFile, type TaskEvent, type TaskFile } from "@/lib/task-detail";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(iso));

/** Görevin fotoğraf ve belgeleri: görseller küçük resim, PDF'ler satır; tıklayınca yeni sekmede açılır. */
export function TaskFiles({ files, empty = "Dosya eklenmemiş." }: { files: TaskFile[]; empty?: string }) {
  if (files.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const images = files.filter(isImageFile);
  const docs = files.filter((f) => !isImageFile(f));
  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((f) => (
            <li key={f.id}>
              <a href={`/api/is-planlama/dosya/${f.id}?goster=1`} target="_blank" rel="noopener" className="group block overflow-hidden rounded-lg border border-border bg-surface-2" title={`${f.file_name} · ${FILE_STAGE_LABELS[f.stage] ?? ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- yetkili, imzalı kısa ömürlü adres; next/image kullanılmaz */}
                <img src={`/api/is-planlama/dosya/${f.id}?goster=1&ham=1`} alt={f.file_name} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                <span className="block truncate px-2 py-1 text-[11px] text-muted">{FILE_STAGE_LABELS[f.stage] ?? f.file_name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map((f) => (
            <li key={f.id}>
              <a href={`/api/is-planlama/dosya/${f.id}?goster=1`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2">
                <FileText className="size-4 shrink-0 text-danger" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                <span className="shrink-0 text-xs text-muted">{FILE_STAGE_LABELS[f.stage]}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DOT: Record<string, string> = {
  issue: "bg-danger",
  accepted: "bg-brand",
  completed: "bg-success",
  finished: "bg-success",
  cancelled: "bg-muted",
};

/** Görevin geçmişi: kim, ne zaman, ne yaptı. `staffTask`: merkez görevi ("Personel" yerine "Görevli" yazar). */
export function TaskTimeline({ events, staffTask = false }: { events: TaskEvent[]; staffTask?: boolean }) {
  if (events.length === 0) return <p className="text-sm text-muted">Kayıt yok.</p>;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={cn("absolute -left-[1.6rem] top-1 size-2.5 rounded-full ring-4 ring-surface", DOT[e.kind] ?? "bg-brand/60")} aria-hidden />
          <p className="text-sm font-medium">{eventLabel(e.kind, staffTask)}</p>
          <p className="text-xs text-muted">
            {fmt(e.created_at)}
            {e.actor_name ? ` · ${e.actor_name}` : ""}
          </p>
          {e.note && <p className={cn("mt-1 whitespace-pre-line text-sm", e.kind === "issue" ? "text-danger" : "text-fg/80")}>{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
