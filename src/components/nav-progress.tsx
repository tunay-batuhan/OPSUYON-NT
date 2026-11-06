"use client";

import { useEffect, type ReactNode } from "react";
import Form from "next/form";
import { useProgress } from "@bprogress/next";
import { ProgressProvider } from "@bprogress/next/app";

/**
 * Sayfa geçişlerinde ekranın üstünde ince ilerleme çubuğu (@bprogress/next).
 *  - Bağlantıya tıklayınca başlar, yeni sayfa açılınca biter.
 *  - Sayfanın "Yükleniyor…" iskeleti ekrandayken dolmaya devam eder (RouteProgress).
 *  - Filtre / arama formlarında da çalışır (NavForm).
 *  - Dosya indirme (/api/...) ve dış bağlantılarda başlamaz: indirmede sayfa değişmez, çubuk takılı kalırdı.
 */
export function NavProgress({ children }: { children: ReactNode }) {
  useEffect(() => {
    const mark = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) a.setAttribute("data-prevent-progress", "true");
    };
    // capture: çubuğun kendi tıklama dinleyicisinden önce çalışır
    document.addEventListener("click", mark, true);
    return () => document.removeEventListener("click", mark, true);
  }, []);

  return (
    <ProgressProvider color="var(--brand)" height="3px" options={{ showSpinner: false }}>
      {children}
    </ProgressProvider>
  );
}

/** loading.tsx iskeletine konur: iskelet ekrandayken çubuk sürer, içerik gelince (iskelet kalkınca) biter. */
export function RouteProgress() {
  const { start, stop, disableAutoStop, enableAutoStop } = useProgress();
  useEffect(() => {
    disableAutoStop();
    start(0, 0, true);
    return () => {
      enableAutoStop();
      stop();
    };
  }, [start, stop, disableAutoStop, enableAutoStop]);
  return null;
}

/**
 * GET formu (filtre, arama): sayfayı baştan yüklemeden gider (next/form) ve çubuğu başlatır.
 * Adres değişmeyecekse (aynı filtreyle tekrar "Filtrele") çubuk başlamaz.
 */
export function NavForm({ action = "", className, children }: { action?: string; className?: string; children: ReactNode }) {
  const { start } = useProgress();
  return (
    <Form
      action={action}
      className={className}
      onSubmit={(e) => {
        // next/form ile aynı kural: form alanları adresin sorgu kısmını oluşturur (boş alanlar dahil)
        const url = new URL(action, location.href);
        url.search = "";
        for (const [k, v] of new FormData(e.currentTarget)) url.searchParams.append(k, typeof v === "string" ? v : v.name);
        if (url.pathname + url.search !== location.pathname + location.search) start();
      }}
    >
      {children}
    </Form>
  );
}
