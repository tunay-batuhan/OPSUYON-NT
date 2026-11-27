"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Clock4, Loader2, Printer, X } from "lucide-react";
import { dismissExpiryAlert } from "@/app/actions/expiry-alerts";
import { releaseBody } from "@/components/confirm-dialog";
import { btn, cn } from "@/components/ui";

export type ExpiryAlertRow = {
  personnel_id: string;
  full_name: string;
  title: string | null;
  kind: "health_report" | "security_card";
  until: string;
  days_left: number;
};

const LABEL = { health_report: "Sağlık raporu", security_card: "Güvenlik kimlik kartı" } as const;
const SLUG = { health_report: "saglik-raporu", security_card: "guvenlik-kimlik" } as const;
const fmt = (iso: string) => iso.split("-").reverse().join(".");

function left(days: number) {
  if (days < 0) return `Süresi ${-days} gün önce doldu`;
  if (days === 0) return "Süresi bugün doluyor";
  return `${days} gün kaldı`;
}

/**
 * Bildirimler › süresi yaklaşan belgeler. "Kapat" önce sorar: personele bildirim evrakı basılsın mı?
 * Evet: bildirim PDF'i yeni sekmede açılır ve uyarı bugün için kapanır. Hayır: yalnızca kapanır. Ertesi gün yeniden çıkar.
 */
export function ExpiryAlertList({ rows }: { rows: ExpiryAlertRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<ExpiryAlertRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // son uyarı kapanınca liste sayfadan kalkar; Radix'in body kilidi takılı kalmasın
  useEffect(() => {
    if (!open) releaseBody();
    return () => releaseBody();
  }, [open]);

  function close(row: ExpiryAlertRow, print: boolean) {
    // pencere, tıklamanın içinde açılmalı (açılır pencere engelleyicisi)
    if (print) window.open(`/api/personel/${row.personnel_id}/form/${SLUG[row.kind]}`, "_blank", "noopener");
    setError(null);
    start(async () => {
      const res = await dismissExpiryAlert({ personnelId: row.personnel_id, kind: row.kind, printed: print });
      if (res.error) setError(res.error);
      setOpen(null);
      router.refresh();
    });
  }

  return (
    <>
      {error && <p role="alert" className="mx-5 mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const late = r.days_left < 0;
          return (
            <li key={`${r.personnel_id}:${r.kind}`} className="flex items-center gap-3 px-5 py-3">
              <Clock4 className={cn("size-5 shrink-0", late ? "text-danger" : "text-warning")} aria-hidden />
              <span className="min-w-0 flex-1">
                <Link href={`/merkez/personel/${r.personnel_id}`} className="block font-medium hover:text-brand">
                  {LABEL[r.kind]}: {r.full_name}
                  {r.title && <span className="font-normal text-muted"> · {r.title}</span>}
                </Link>
                <span className={cn("block text-sm", late ? "font-medium text-danger" : "text-muted")}>
                  Bitiş {fmt(r.until)} · {left(r.days_left)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(r)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium hover:bg-surface-2"
              >
                <X className="size-4" aria-hidden /> Kapat
              </button>
            </li>
          );
        })}
      </ul>

      <AlertDialog.Root open={open !== null} onOpenChange={(v) => !v && !pending && setOpen(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="confirm-overlay fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-[2px]" />
          <AlertDialog.Content className="confirm-content fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 text-left text-fg shadow-[0_24px_64px_rgb(12_31_69/0.28)] ring-1 ring-border focus:outline-none">
            {open && (
              <>
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand" aria-hidden>
                    <Printer className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <AlertDialog.Title className="text-base font-semibold leading-snug">Personele bildirim evrakı basılsın mı?</AlertDialog.Title>
                    <AlertDialog.Description className="mt-1.5 text-sm leading-relaxed text-muted">
                      {open.full_name} — {LABEL[open.kind].toLocaleLowerCase("tr")} {fmt(open.until)} tarihinde {open.days_left < 0 ? "doldu" : "doluyor"}.
                      Uyarı bugün için kapanır, yarın yeniden çıkar. Evet derseniz imzalı tebliğ için bildirim yazısı yeni sekmede açılır.
                    </AlertDialog.Description>
                  </div>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <AlertDialog.Cancel disabled={pending} className={btn("ghost", "md")}>Vazgeç</AlertDialog.Cancel>
                  <button type="button" disabled={pending} onClick={() => close(open, false)} className={btn("secondary", "md")}>
                    Hayır, sadece kapat
                  </button>
                  <button type="button" disabled={pending} onClick={() => close(open, true)} className={btn("primary", "md")}>
                    {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Printer className="size-4" aria-hidden />} Evet, bas
                  </button>
                </div>
              </>
            )}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
