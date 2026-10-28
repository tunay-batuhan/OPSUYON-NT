"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Download, Eye, X } from "lucide-react";
import { cn } from "@/components/ui";

export type ViewDoc = { src: string; title: string; downloadHref?: string };
type Ctx = { current: ViewDoc | null; open: (d: ViewDoc) => void; close: () => void };

const ViewerCtx = createContext<Ctx | null>(null);

/**
 * Sayfadaki her "Görüntüle" düğmesi belgeyi indirmeden, sayfanın en altındaki görüntüleyicide açar.
 * Sayfa değişince görüntüleyici kendiliğinden kapanır.
 */
export function DocViewerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ path: string; doc: ViewDoc } | null>(null);
  const value = useMemo<Ctx>(
    () => ({
      current: state && state.path === pathname ? state.doc : null,
      open: (doc) => setState({ path: pathname, doc }),
      close: () => setState(null),
    }),
    [state, pathname],
  );
  return <ViewerCtx.Provider value={value}>{children}</ViewerCtx.Provider>;
}

/** Sayfa içeriğinin altına konur; açık belge varsa onu gösterir. */
export function DocViewerHost() {
  const ctx = useContext(ViewerCtx);
  const ref = useRef<HTMLDivElement>(null);
  const current = ctx?.current ?? null;

  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current]);

  if (!ctx || !current) return null;
  return (
    <div ref={ref} id="belge-goruntuleyici" className="mt-6 scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-surface shadow-card print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-5 py-3">
        <p className="flex min-w-0 items-center gap-2 font-semibold">
          <Eye className="size-4 shrink-0 text-brand" aria-hidden />
          <span className="truncate">{current.title}</span>
        </p>
        <div className="flex items-center gap-2">
          {current.downloadHref && (
            <a href={current.downloadHref} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">
              <Download className="size-4" aria-hidden /> PDF indir
            </a>
          )}
          <button type="button" onClick={ctx.close} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium hover:bg-surface-2" aria-label="Görüntüleyiciyi kapat">
            <X className="size-4" aria-hidden /> Kapat
          </button>
        </div>
      </div>
      <iframe key={current.src} src={current.src} title={current.title} className="h-[75vh] min-h-96 w-full bg-white" />
    </div>
  );
}

const btnCls = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-fg hover:bg-surface-2";

/** "Görüntüle": belgeyi sayfanın altında açar (görüntüleyici yoksa yeni sekmede). */
export function ViewButton({ src, title, downloadHref, label = "Görüntüle", className }: { src: string; title: string; downloadHref?: string; label?: string; className?: string }) {
  const ctx = useContext(ViewerCtx);
  if (!ctx) {
    return (
      <a href={src} target="_blank" rel="noreferrer" className={cn(btnCls, className)}>
        <Eye className="size-4" aria-hidden /> {label}
      </a>
    );
  }
  const active = ctx.current?.src === src;
  return (
    <button type="button" onClick={() => ctx.open({ src, title, downloadHref })} aria-label={`${title} — ${label.toLowerCase()}`} aria-pressed={active} className={cn(btnCls, active && "border-brand bg-brand-soft text-brand", className)}>
      <Eye className="size-4" aria-hidden /> {label}
    </button>
  );
}
