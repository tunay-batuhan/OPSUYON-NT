"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote, BarChart3, Bell, BookOpen, Building2, CalendarClock, CalendarOff, CalendarCheck, FileSignature,
  FolderKanban, History, Home, Loader2, MessageSquare, Receipt, UserCog, UserRound, Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";

/** Fixed-size slot so the spinner never shifts layout. */
function Pending() {
  const { pending } = useLinkStatus();
  return <Loader2 aria-hidden className={cn("ml-auto size-4 animate-spin transition-opacity", pending ? "opacity-100" : "opacity-0")} />;
}

export const navIcons: Record<string, LucideIcon> = {
  home: Home,
  projects: FolderKanban,
  personnel: Users,
  timesheets: CalendarCheck,
  shifts: CalendarClock,
  leaves: CalendarOff,
  contracts: FileSignature,
  payroll: Banknote,
  invoices: Receipt,
  ledger: BookOpen,
  reports: BarChart3,
  messages: MessageSquare,
  organizations: Building2,
  users: UserCog,
  audit: History,
  bell: Bell,
  profile: UserRound,
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof navIcons;
  exact?: boolean;
  group?: string;
  /** Extra path prefixes that also mark this item active. */
  match?: string[];
};

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact" | "match">) {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Vertical navigation for the navy sidebar / mobile drawer. */
export function Nav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Ana menü" className="flex flex-col gap-1">
      {items.map((item, i) => {
        const Icon = navIcons[item.icon] ?? Home;
        const active = isActive(pathname, item);
        const showGroup = Boolean(item.group) && item.group !== items[i - 1]?.group;
        return (
          <div key={item.href} className="contents">
            {showGroup && (
              <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--side-fg)]/60">
                {item.group}
              </p>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--side-active)] text-[color:var(--side-active-fg)] shadow-sm"
                  : "text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-[color:var(--side-fg-strong)]",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {item.label}
              <Pending />
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
