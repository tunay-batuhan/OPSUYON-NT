"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClipboardList, LogOut, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/gorevlerim", label: "Görevlerim", Icon: ClipboardList },
  { href: "/hesabim", label: "Hesabım", Icon: UserRound },
];

/**
 * Personelin telefon ekranı: lacivert üst çubuk (logo, ad, çıkış) + alttaki 2 sekme (Görevlerim, Hesabım; personel bordro görmez). Masaüstünde ortada dar sütun.
 * `locked`: parola değiştirilene kadar sekmeler gizlenir (yalnızca Hesabım açılır).
 */
export function PortalShell({ fullName, locked, children }: { fullName: string; locked: boolean; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-30 bg-[var(--side-bg)] text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
          <Logo href="/gorevlerim" dark size="sm" gradientId="lm-ring-portal" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-white/90">{fullName}</span>
            <form action={logoutAction}>
              <button className="grid size-9 place-items-center rounded-lg text-white/80 hover:bg-[var(--side-hover)] hover:text-white" aria-label="Çıkış yap" title="Çıkış yap">
                <LogOut className="size-[18px]" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="icerik" className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-5">
        {children}
      </main>

      {!locked && (
        <nav aria-label="Personel menüsü" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid max-w-xl grid-cols-3">
            {TABS.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-1 py-2.5 text-xs font-semibold", active ? "text-brand" : "text-muted hover:text-fg")}
                >
                  <Icon className="size-[22px]" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
