"use client";

import { Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/documents";
import { ConfirmSubmit, type ConfirmText } from "@/components/confirm-dialog";
import { cn } from "@/components/ui";

/**
 * Liste ekranlarındaki (Bordrolar, Denetimler, Puantaj, Faturalar, Risk Analizi…) "Sil": onay penceresi açar,
 * belgeyi ve dosyasını kalıcı siler, `back` listesini yeniler. `action`/`confirm` ile başka kayıtlar için de
 * kullanılır (ör. cari Excel ekstresi).
 */
export function DeleteDocButton({
  id, title, back, className, action = deleteDocument, confirm, extra,
}: {
  id: string; title: string; back: string; className?: string;
  action?: (fd: FormData) => Promise<void>;
  /** Onay penceresinin metni; verilmezse "“<başlık>” silinsin mi?" */
  confirm?: Partial<ConfirmText>;
  /** forma eklenecek diğer gizli alanlar */
  extra?: Record<string, string>;
}) {
  return (
    <form action={action} className={cn("inline", className)}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <ConfirmSubmit
        title={`“${title}” silinsin mi?`}
        description="Kayıt ve yüklenen dosya kalıcı olarak silinir. Bu işlem geri alınamaz."
        {...confirm}
        label={`${title} — sil`}
        icon={<Trash2 className="size-4" aria-hidden />}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
      >
        Sil
      </ConfirmSubmit>
    </form>
  );
}
