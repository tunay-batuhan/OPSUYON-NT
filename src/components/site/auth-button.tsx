"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { btn, cn } from "@/components/ui";

/** Supabase oturum çerezi (sb-<proje>-auth-token, parçalıysa .0/.1). İçeriği okunmaz; yalnızca var mı diye bakılır. */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/;
const SESSION_COOKIE_NAME = /^sb-.*-auth-token(?:\.\d+)?$/;

type CookieStoreLike = { getAll(): Promise<{ name: string }[]> };

/**
 * Oturum çerezi var mı? Destekleyen tarayıcıda Cookie Store API (eşzamansız); yoksa document.cookie.
 * Chrome, eşzamanlı document.cookie okumasını DevTools "Issues" paneline performans uyarısı olarak yazıyor
 * (Lighthouse En İyi Uygulamalar puanını düşürüyordu).
 */
async function hasSessionCookie(): Promise<boolean> {
  const store = (globalThis as { cookieStore?: CookieStoreLike }).cookieStore;
  if (store?.getAll) {
    try {
      return (await store.getAll()).some((c) => SESSION_COOKIE_NAME.test(c.name));
    } catch {
      // erişim engellenmiş: aşağıdaki yola düş
    }
  }
  return SESSION_COOKIE.test(document.cookie);
}

/**
 * "Giriş Yap" / "Panele git". Tanıtım sayfaları statik üretildiği için sunucuda oturum okunmaz (yoksa her sayfa
 * her istekte yeniden çizilirdi). Varsayılan "Giriş Yap"; tarayıcıda oturum çerezi varsa /api/session sorulur ve
 * oturum geçerliyse düğme kişinin paneline gider. Oturum çerezi olmayan ziyaretçi için sunucuya hiç istek gitmez.
 */
export function AuthButton({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    hasSessionCookie()
      .then((has) => (has && !ctrl.signal.aborted ? fetch("/api/session", { cache: "no-store", signal: ctrl.signal }) : null))
      .then((r) => (r?.ok ? r.json() : null))
      .then((d: { href?: unknown } | null) => {
        if (typeof d?.href === "string" && d.href.startsWith("/")) setHref(d.href);
      })
      .catch(() => {
        // ağ hatası / iptal: "Giriş Yap" kalır (giriş sayfası oturum açıksa zaten panele yönlendirir)
      });
    return () => ctrl.abort();
  }, []);

  const icon = size === "lg" ? "size-5" : "size-4";
  return (
    <Link href={href ?? "/giris"} className={cn(btn("primary", size, "whitespace-nowrap shadow-card"), className)}>
      {href ? (
        <>Panele git <ArrowRight className={icon} aria-hidden /></>
      ) : (
        <><LogIn className={icon} aria-hidden /> Giriş Yap</>
      )}
    </Link>
  );
}
