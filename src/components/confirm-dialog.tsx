"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { btn, cn } from "@/components/ui";

export type ConfirmTone = "danger" | "warning";

export type ConfirmText = {
  /** Kısa soru: "“Bordro 10/2026” silinsin mi?" */
  title: string;
  /** Sonucu anlatan bir-iki cümle */
  description?: ReactNode;
  /** Silinecek/değişecek kalemler (kutuda listelenir) */
  items?: ReactNode[];
  /** Onay düğmesi metni (varsayılan "Sil") */
  confirmLabel?: string;
  tone?: ConfirmTone;
};

const TONE = {
  danger: { icon: Trash2, ring: "bg-danger-soft text-danger", action: "bg-danger text-white hover:brightness-110 focus-visible:ring-danger/40" },
  warning: { icon: AlertTriangle, ring: "bg-warning-soft text-warning", action: "bg-brand text-brand-fg hover:bg-brand-hover focus-visible:ring-brand/40" },
} as const;

/**
 * Radix, pencere açıkken sayfanın geri kalanına tıklamayı kapatır (body `pointer-events: none`). Pencere kapanırken
 * tetikleyici de sayfadan kalkarsa (ör. silinen satır listeden çıkınca) bu ayar takılı kalabilir: sayfa "donmuş"
 * gibi olur, imleç el olmaz. Kapanış animasyonundan sonra açık başka pencere yoksa temizlenir.
 */
function releaseBody() {
  window.setTimeout(() => {
    if (!document.querySelector('[role="alertdialog"], [role="dialog"]') && document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
  }, 250);
}

/**
 * Tarayıcının confirm() kutusu yerine kullanılan onay penceresi (Radix AlertDialog: odak kilidi, Esc ile kapanma,
 * ekran okuyucu desteği). `children` tetikleyici düğmedir; onaylanınca `onConfirm` çalışır.
 */
export function ConfirmDialog({
  children, title, description, items, confirmLabel = "Sil", tone = "danger", onConfirm,
}: ConfirmText & { children: ReactNode; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) releaseBody();
    return () => releaseBody(); // tetikleyici sayfadan kalkınca da
  }, [open]);
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="confirm-overlay fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-[2px]" />
        <AlertDialog.Content
          className="confirm-content fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 text-left text-fg shadow-[0_24px_64px_rgb(12_31_69/0.28)] ring-1 ring-border focus:outline-none"
        >
          <div className="flex items-start gap-4">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", t.ring)} aria-hidden>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <AlertDialog.Title className="text-base font-semibold leading-snug text-balance [overflow-wrap:anywhere]">{title}</AlertDialog.Title>
              <AlertDialog.Description asChild={!description} className="mt-1.5 text-sm leading-relaxed text-muted">
                {description ?? <span className="sr-only">Onaylamak için {confirmLabel}, vazgeçmek için Vazgeç</span>}
              </AlertDialog.Description>
              {items && items.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
                  {items.map((it, i) => (
                    <li key={i} className="flex gap-2 [overflow-wrap:anywhere]">
                      <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", tone === "danger" ? "bg-danger" : "bg-warning")} aria-hidden />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={btn("secondary", "md", "sm:min-w-24")}>Vazgeç</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition sm:min-w-24 focus-visible:outline-none focus-visible:ring-4",
                t.action,
              )}
            >
              {tone === "danger" && <Trash2 className="size-4" aria-hidden />}
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * Sunucu formu içindeki gönder düğmesi: önce onay penceresi açılır, onaylanınca form gönderilir.
 * Gönderim sürerken `icon` yerine döner simge görünür.
 */
export function ConfirmSubmit({
  children, className, label, icon, ...text
}: ConfirmText & { children: ReactNode; className?: string; label?: string; icon?: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();
  return (
    <ConfirmDialog {...text} onConfirm={() => ref.current?.form?.requestSubmit()}>
      <button ref={ref} type="button" disabled={pending} aria-label={label} className={className}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
        {children}
      </button>
    </ConfirmDialog>
  );
}
