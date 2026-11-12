"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { btn, cn } from "@/components/ui";

/** Supabase oturum çerezi (sb-<proje>-auth-token, parçalıysa .0/.1). İçeriği okunmaz; yalnızca var mı diye bakılır. */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/;

/**
 * "Giriş Yap" / "Panele git". Tanıtım sayfaları statik üretildiği için sunucuda oturum okunmaz (yoksa her sayfa
 * her istekte yeniden çizilirdi). Varsayılan "Giriş Yap"; tarayıcıda oturum çerezi varsa /api/session sorulur ve
 * oturum geçerliyse düğme kişinin paneline gider. Oturum çerezi olmayan ziyaretçi için sunucuya hiç istek gitmez.
 */
export function AuthButton({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!SESSION_COOKIE.test(document.cookie)) return;
    const ctrl = new AbortController();
    fetch("/api/session", { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
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
