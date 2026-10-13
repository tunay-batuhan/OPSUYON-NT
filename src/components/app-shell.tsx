"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Nav, type NavItem } from "@/components/nav";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/components/ui";

type ShellUser = { fullName: string; username: string; roleLabel: string; initials: string };

function SidebarBody({ items, user, home, onNavigate, onClose }: { items: NavItem[]; user: ShellUser; home: string; onNavigate?: () => void; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <Logo href={home} dark />
        {onClose && (
          <button onClick={onClose} className="grid size-9 place-items-center rounded-lg text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-white" aria-label="Menüyü kapat">
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        <Nav items={items} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-[color:var(--side-border)] pt-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--side-active)] text-sm font-semibold text-[color:var(--side-active-fg)]" aria-hidden>
            {user.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
            <p className="truncate text-xs text-[color:var(--side-fg)]">{user.roleLabel} · @{user.username}</p>
          </div>
        </div>
        <form action={logoutAction} className="mt-3">
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-white">
            <LogOut className="size-4" aria-hidden /> Çıkış yap
          </button>
        </form>
      </div>
    </div>
  );
}

/** Desktop: fixed dark sidebar. Mobile/tablet: top bar with a hamburger that opens a slide-in drawer. */
export function AppShell({ items, user, home, children }: { items: NavItem[]; user: ShellUser; home: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* desktop sidebar */}
      <aside className="hidden bg-[var(--side-bg)] lg:sticky lg:top-0 lg:block lg:h-screen">
        <SidebarBody items={items} user={user} home={home} />
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[var(--side-bg)] px-3 shadow-md lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-lg text-white hover:bg-[var(--side-hover)]"
          aria-label="Menüyü aç"
          aria-expanded={open}
          aria-controls="mobile-drawer"
        >
          <Menu className="size-6" aria-hidden />
        </button>
        <Logo href={home} dark />
        <span className="grid size-9 place-items-center rounded-full bg-[var(--side-active)] text-sm font-semibold text-[color:var(--side-active-fg)]" aria-hidden>
          {user.initials}
        </span>
      </header>

      {/* mobile drawer */}
      <div className={cn("fixed inset-0 z-40 lg:hidden", open ? "visible" : "invisible")}>
        <div
          onClick={() => setOpen(false)}
          className={cn("absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
          aria-hidden
        />
        <aside
          id="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menü"
          className={cn(
            "absolute inset-y-0 left-0 w-[17.5rem] max-w-[85vw] bg-[var(--side-bg)] shadow-2xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarBody items={items} user={user} home={home} onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
        </aside>
      </div>

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
