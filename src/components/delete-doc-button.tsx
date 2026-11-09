"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/documents";
import { cn } from "@/components/ui";

function Submit({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      aria-label={`${title} — sil`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Sil
    </button>
  );
}

/**
 * Liste ekranlarındaki (Bordrolar, Denetimler, Puantaj) "Sil": onay sorar, belgeyi ve dosyasını kalıcı siler,
 * `back` listesini yeniler.
 */
export function DeleteDocButton({ id, title, back, className }: { id: string; title: string; back: string; className?: string }) {
  return (
    <form
      action={deleteDocument}
      onSubmit={(e) => {
        if (!window.confirm(`“${title}” kalıcı olarak silinsin mi? Dosya da silinir, geri alınamaz.`)) e.preventDefault();
      }}
      className={cn("inline", className)}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <Submit title={title} />
    </form>
  );
}
