"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote, BarChart3, Bell, BookOpen, Building2, CalendarClock, CalendarOff, CalendarCheck, ChevronDown, ClipboardCheck,
  FileSignature, FileStack, FolderKanban, History, Home, Loader2, MessageSquare, Receipt, Route, ShieldAlert, SlidersHorizontal, UserCog, UserRound, Users,
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
  inspections: ClipboardCheck,
  modules: SlidersHorizontal,
  forms: FileStack,
  risk: ShieldAlert,
  patrol: Route,
};

export type NavChild = { href: string; label: string; exact?: boolean };
export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof navIcons;
  exact?: boolean;
  group?: string;
  /** Extra path prefixes that also mark this item active. */
  match?: string[];
  /** Alt menü (tıklayınca açılır). */
  children?: NavChild[];
  /** Etiketin yanında küçük rozet (örn. "Demo": henüz onaylanmamış bölüm). */
  badge?: string;
};

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact" | "match">) {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const linkCls = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "bg-[var(--side-active)] text-[color:var(--side-active-fg)] shadow-sm"
      : "text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-[color:var(--side-fg-strong)]",
  );

function Badge({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="rounded-full bg-[var(--tone-amber)] px-1.5 py-px text-[10px] font-bold uppercase leading-4 tracking-wide text-white">{text}</span>;
}

function NavGroup({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const Icon = navIcons[item.icon] ?? Home;
  const children = item.children ?? [];
  const childActive = children.some((c) => isActive(pathname, c));
  const parentActive = isActive(pathname, item) && !childActive;
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? (childActive || parentActive);

  return (
    <div>
      <div className="flex items-stretch gap-1">
        <Link href={item.href} onClick={onNavigate} aria-current={parentActive ? "page" : undefined} className={cn(linkCls(parentActive), "flex-1", childActive && "text-[color:var(--side-fg-strong)]")}>
          <Icon className="size-[18px] shrink-0" aria-hidden />
          {item.label}
          <Badge text={item.badge} />
          <Pending />
        </Link>
        <button
          type="button"
          onClick={() => setManual(!open)}
          aria-expanded={open}
          aria-label={`${item.label} alt menüsü`}
          className="grid w-9 place-items-center rounded-lg text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-white"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="ml-5 mt-1 space-y-0.5 border-l border-[color:var(--side-border)] pl-3">
          {children.map((c) => {
            const active = isActive(pathname, c);
            return (
              <Link
                key={c.href}
                href={c.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                  active ? "bg-[var(--side-active)] text-white" : "text-[color:var(--side-fg)] hover:bg-[var(--side-hover)] hover:text-white",
                )}
              >
                {c.label}
                <Pending />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Vertical navigation for the navy sidebar / mobile drawer. */
export function Nav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Ana menü" className="flex flex-col gap-1">
      {items.map((item, i) => {
        const Icon = navIcons[item.icon] ?? Home;
        const showGroup = Boolean(item.group) && item.group !== items[i - 1]?.group;
        return (
          <div key={item.href + item.label} className="contents">
            {showGroup && (
              <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--side-fg)]/60">
                {item.group}
              </p>
            )}
            {item.children?.length ? (
              <NavGroup item={item} onNavigate={onNavigate} />
            ) : (
              <Link href={item.href} onClick={onNavigate} aria-current={isActive(pathname, item) ? "page" : undefined} className={linkCls(isActive(pathname, item))}>
                <Icon className="size-[18px] shrink-0" aria-hidden />
                {item.label}
                <Badge text={item.badge} />
                <Pending />
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
