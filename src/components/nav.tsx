"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, FolderKanban, History, LayoutDashboard, LifeBuoy, MessageSquare, UserCog, Users,
  type LucideIcon,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/components/ui";

/** Fixed-size slot so the spinner never shifts layout. */
function Pending() {
  const { pending } = useLinkStatus();
  return <Loader2 aria-hidden className={cn("ml-auto size-4 animate-spin transition-opacity", pending ? "opacity-100" : "opacity-0")} />;
}

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  organizations: Building2,
  projects: FolderKanban,
  personnel: Users,
  users: UserCog,
  messages: MessageSquare,
  audit: History,
  help: LifeBuoy,
};

export type NavItem = { href: string; label: string; icon: keyof typeof icons; exact?: boolean; group?: string };

/** Vertical navigation for the dark sidebar / mobile drawer. */
export function Nav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Ana menü" className="flex flex-col gap-1">
      {items.map((item, i) => {
        const Icon = icons[item.icon] ?? LayoutDashboard;
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        const showGroup = Boolean(item.group) && item.group !== items[i - 1]?.group;
        return (
          <div key={item.href} className="contents">
            {showGroup && (
              <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--side-fg)]/60 first:mt-0">
                {item.group}
              </p>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--side-active)] text-[color:var(--side-active-fg)]"
                  : "text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-[color:var(--side-fg-strong)]",
              )}
            >
              {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[color:var(--side-active-fg)]" />}
              <Icon className="size-[18px]" aria-hidden />
              {item.label}
              <Pending />
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
