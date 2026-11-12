"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/components/ui";
import { SITE_NAV } from "@/components/site/nav-items";

const isCurrent = (pathname: string, href: string) => !href.includes("#") && pathname === href;

/** Masaüstünde yatay menü. `lg`: menü ancak geniş ekranda yatay görünür (ana sayfada büyük logo ve düğmeyle sığsın diye). */
export function DesktopNav({ lg = false }: { lg?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Ana menü" className={lg ? "hidden lg:block" : "hidden md:block"}>
      <ul className="flex items-center gap-1">
        {SITE_NAV.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-soft hover:text-navy",
                  current ? "text-brand" : "text-navy/80",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Mobil menü: düğme açar/kapatır (aria-expanded), Esc ile ya da bir bağlantıya basınca kapanır, kapanınca odak
 * düğmeye döner. JavaScript yoksa aynı bağlantılar alt bilgide de vardır.
 */
export function MobileNav({ lg = false }: { lg?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);

  // sayfa değişince kapanır
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={lg ? "lg:hidden" : "md:hidden"}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-lg text-navy hover:bg-brand-soft"
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        <span className="sr-only">{open ? "Menüyü kapat" : "Menüyü aç"}</span>
      </button>
      <nav
        id={id}
        aria-label="Ana menü"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-surface px-4 pb-4 pt-2 shadow-card"
      >
        <ul className="flex flex-col">
          {SITE_NAV.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn("block rounded-lg px-3 py-3 text-base font-medium hover:bg-brand-soft", current ? "text-brand" : "text-navy")}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
