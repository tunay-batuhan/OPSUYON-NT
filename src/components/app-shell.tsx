"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Home, LogOut, Menu, MessageSquare, Search, UserRound, X } from "lucide-react";
import { Assistant } from "@/components/assistant";
import { Logo } from "@/components/logo";
import { Nav, type NavItem } from "@/components/nav";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/components/ui";

type ShellUser = { fullName: string; username: string; roleLabel: string; initials: string; greetingName: string };

function SidebarBody({ items, home, onNavigate, onClose }: { items: NavItem[]; home: string; onNavigate?: () => void; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <Logo href={home} dark size="sm" />
        {onClose && (
          <button onClick={onClose} className="grid size-9 place-items-center rounded-lg text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-white" aria-label="Menüyü kapat">
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="side-scroll -mx-1 flex-1 overflow-y-auto px-1">
        <Nav items={items} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-[color:var(--side-border)] pt-4">
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-white">
            <LogOut className="size-4" aria-hidden /> Çıkış yap
          </button>
        </form>
      </div>
    </div>
  );
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[var(--tone-amber)] px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Desktop: navy sidebar + top bar (greeting, search, bell, avatar).
 * Mobile/tablet: navy top bar with hamburger + drawer, and a bottom tab bar (Mesajlar, Bildirimler, Profil).
 */
export function AppShell({
  items, user, home, kind, notifications, unreadMessages, assistant = false, children,
}: { items: NavItem[]; user: ShellUser; home: string; kind: "staff" | "customer"; notifications: number; unreadMessages: number; assistant?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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

  // Müşteride Mesajlar menüsü kapalı (ana sayfada görünür): alt çubuk Ana Sayfa · Bildirimler · Profil
  const tabs = [
    kind === "staff"
      ? { href: "/mesajlar", label: "Mesajlar", Icon: MessageSquare, badge: unreadMessages }
      : { href: home, label: "Ana Sayfa", Icon: Home, badge: unreadMessages },
    { href: "/bildirimler", label: "Bildirimler", Icon: Bell, badge: notifications },
    { href: "/profil", label: "Profil", Icon: UserRound, badge: 0 },
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* desktop sidebar */}
      <aside className="hidden bg-[var(--side-bg)] lg:sticky lg:top-0 lg:block lg:h-screen">
        <SidebarBody items={items} home={home} />
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
        <Logo href={home} dark size="sm" />
        <Link href="/ara" className="grid size-10 place-items-center rounded-lg text-white hover:bg-[var(--side-hover)]" aria-label="Ara">
          <Search className="size-5" aria-hidden />
        </Link>
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
          <SidebarBody items={items} home={home} onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
        </aside>
      </div>

      <div className="min-w-0">
        {/* desktop top bar */}
        <div className="sticky top-0 z-20 hidden items-center justify-between gap-6 border-b border-border bg-bg/85 px-8 py-3 backdrop-blur lg:flex">
          <div>
            <p className="text-xs text-muted">Hoş Geldiniz,</p>
            <p className="font-semibold">{user.greetingName}</p>
          </div>
          <div className="flex items-center gap-3">
            <form action="/ara" className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                name="q"
                aria-label="Ara"
                placeholder="Proje, personel, belge ara…"
                className="h-10 w-72 rounded-full border border-border bg-surface pl-9 pr-4 text-sm placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </form>
            <Link href="/bildirimler" className="relative grid size-10 place-items-center rounded-full border border-border bg-surface text-muted hover:text-fg" aria-label={`Bildirimler${notifications ? ` (${notifications})` : ""}`}>
              <Bell className="size-5" aria-hidden />
              <Badge n={notifications} />
            </Link>
            <Link href="/profil" className="flex items-center gap-2.5 rounded-full border border-border bg-surface py-1 pl-1 pr-4 hover:border-brand" aria-label="Profil">
              <span className="grid size-8 place-items-center rounded-full bg-[var(--navy)] text-xs font-bold text-white" aria-hidden>{user.initials}</span>
              <span className="text-left leading-tight">
                <span className="block text-sm font-medium">{user.fullName}</span>
                <span className="block text-[11px] text-muted">{user.roleLabel}</span>
              </span>
            </Link>
          </div>
        </div>

        <main className="px-4 pb-24 pt-6 sm:px-8 lg:pb-10 lg:pt-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* mobile bottom tab bar */}
      <nav aria-label="Hızlı erişim" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabs.map(({ href, label, Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand" : "text-muted")}>
              <span className="relative">
                <Icon className="size-5" aria-hidden />
                <Badge n={badge} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {assistant && <Assistant kind={kind} />}
    </div>
  );
}
