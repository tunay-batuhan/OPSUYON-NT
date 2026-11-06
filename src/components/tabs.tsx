"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/components/ui";

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null;
}

export type TabItem = { href: string; label: string; exact?: boolean };

/**
 * Sayfa sekmeleri (her sekme tek iş). Seçili sekme dolu mavi; "Evraklar (14)" gibi sayılar rozet olur.
 * Sığmazsa yatay kayar ama kaydırma çubuğu gösterilmez.
 */
export function Tabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Bölümler"
      className="no-scrollbar mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 shadow-card"
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        const m = item.label.match(/^(.*) \((\d+)\)$/);
        const text = m ? m[1] : item.label;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              active ? "bg-brand text-brand-fg shadow-sm" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {text}
            {m && (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", active ? "bg-white/20 text-brand-fg" : "bg-surface-2 text-muted")}>
                {m[2]}
              </span>
            )}
            <Pending />
          </Link>
        );
      })}
    </nav>
  );
}
