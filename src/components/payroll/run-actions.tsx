"use client";

import { FileDown, FileSpreadsheet, Loader2, Lock, LockOpen, PlayCircle, Trash2, UserPlus } from "lucide-react";
import { approvePayrollRun, deletePayrollRun, startPayrollRun, syncPayrollRun, unlockPayrollRun } from "@/app/actions/payroll";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { btn } from "@/components/ui";
import { ActionResult } from "./action-result";
import { useAction } from "./use-action";

/** Dönem yokken: "Bu ay için bordroyu başlat". */
export function StartRunButton({ projectId, year, month, label }: { projectId: string; year: number; month: number; label: string }) {
  const { pending, result, run } = useAction();
  return (
    <div className="space-y-3">
      <button type="button" disabled={pending} onClick={() => run(() => startPayrollRun({ project_id: projectId, year, month }))} className={btn("primary", "lg")}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <PlayCircle className="size-5" aria-hidden />}
        {label}
      </button>
      <ActionResult result={result} />
    </div>
  );
}

/**
 * Dönemin düğmeleri: indirme (Toplu PDF, Excel), eksik personeli ekle, onayla ve kilitle, kilidi aç (merkez),
 * dönemi sil (taslak).
 */
export function RunToolbar({
  runId, locked, canRun, canUnlock, title, count,
}: { runId: string; locked: boolean; canRun: boolean; canUnlock: boolean; title: string; count: number }) {
  const { pending, result, run } = useAction();
  const sec = btn("secondary", "sm");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/bordro/donem/${runId}?format=pdf`} className={sec}>
          <FileDown className="size-4" aria-hidden /> Toplu PDF
        </a>
        <a href={`/api/bordro/donem/${runId}?format=xlsx`} className={sec}>
          <FileSpreadsheet className="size-4" aria-hidden /> Excel indir
        </a>
        {!locked && canRun && (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => syncPayrollRun(runId))} className={sec}>
              <UserPlus className="size-4" aria-hidden /> Eksik personeli ekle
            </button>
            <ConfirmDialog
              tone="warning"
              title={`${title} onaylansın mı?`}
              description="Tüm satırlar güncel ücret tanımı ve avanslarla son kez hesaplanır, sonra dönem kilitlenir. Kilitli dönemde gün, avans ve kesinti değiştirilemez. Kilidi yalnızca merkez açabilir."
              items={[`${count} personel`]}
              confirmLabel="Onayla ve kilitle"
              onConfirm={() => run(() => approvePayrollRun(runId))}
            >
              <button type="button" disabled={pending || count === 0} className={btn("primary", "sm")}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />} Onayla ve kilitle
              </button>
            </ConfirmDialog>
            <ConfirmDialog
              title={`${title} silinsin mi?`}
              description="Dönemin tüm satırları (eksik gün, fazla mesai, kesintiler) silinir. Avanslar ve ücret tanımları silinmez."
              confirmLabel="Dönemi sil"
              onConfirm={() => run(() => deletePayrollRun(runId))}
            >
              <button type="button" disabled={pending} className={btn("ghost", "sm", "text-danger hover:bg-danger-soft hover:text-danger")}>
                <Trash2 className="size-4" aria-hidden /> Dönemi sil
              </button>
            </ConfirmDialog>
          </>
        )}
        {locked && canUnlock && (
          <ConfirmDialog
            tone="warning"
            title={`${title} kilidi açılsın mı?`}
            description="Dönem yeniden taslak olur; gün, avans ve kesintiler değiştirilebilir. Personel düzeltilen bordroyu ancak yeniden onaylanınca görür. İşlem geçmişine yazılır."
            confirmLabel="Kilidi aç"
            onConfirm={() => run(() => unlockPayrollRun(runId))}
          >
            <button type="button" disabled={pending} className={sec}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LockOpen className="size-4" aria-hidden />} Kilidi aç
            </button>
          </ConfirmDialog>
        )}
      </div>
      <ActionResult result={result} />
    </div>
  );
}
