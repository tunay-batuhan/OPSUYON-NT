import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { cn } from "@/components/ui";

/** PDF indir ikonu / düğmesi (müşterinin istediği "PDF olarak indir"). */
export function DownloadLink({ id, label = "PDF indir", icon = true, className }: { id: string; label?: string; icon?: boolean; className?: string }) {
  return (
    <a
      href={`/api/documents/${id}`}
      title={label}
      className={cn("inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft", className)}
    >
      {icon && <Download className="size-4" aria-hidden />} {label}
    </a>
  );
}

/** Kırmızı PDF rozeti + indirme (Denetimler listesindeki PDF ikonu gibi). */
export function PdfIcon({ id, title }: { id: string; title: string }) {
  return (
    <a href={`/api/documents/${id}`} title={`${title} — indir`} aria-label={`${title} PDF indir`} className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-danger-soft">
      <span className="grid size-8 place-items-center rounded-md bg-danger text-[10px] font-bold text-white">PDF</span>
    </a>
  );
}

/** Sayfa içi önizleme. PDF/görsel gömülür; Excel gibi dosyalar için "Excel Aç" (indir) gösterilir. */
export function DocPreview({ id, title, fileName, mime }: { id: string; title: string; fileName: string; mime: string | null }) {
  const previewable = mime === "application/pdf" || (mime ?? "").startsWith("image/") || /\.(pdf|png|jpe?g)$/i.test(fileName);
  const sheet = /\.(xlsx?|csv)$/i.test(fileName);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-5 py-3">
        <p className="flex items-center gap-2 font-semibold">
          {sheet ? <FileSpreadsheet className="size-4 text-success" aria-hidden /> : <FileText className="size-4 text-danger" aria-hidden />} {title}
        </p>
        <DownloadLink id={id} label={sheet ? "Excel Aç" : "PDF indir"} />
      </div>
      {previewable ? (
        <iframe src={`/api/documents/${id}/view#toolbar=1`} title={title} className="h-[75vh] min-h-96 w-full bg-white" />
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted">Bu dosya türü sayfada önizlenemez. Yukarıdaki düğmeyle açabilirsiniz.</p>
      )}
    </div>
  );
}
