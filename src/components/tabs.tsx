"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/components/ui";

function Pending() {
  const { pending } = useLinkStatus();
  return <Loader2 aria-hidden className={cn("ml-1.5 inline size-3.5 animate-spin align-[-2px] transition-opacity", pending ? "opacity-100" : "opacity-0")} />;
}

export type TabItem = { href: string; label: string; exact?: boolean };

export function Tabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Bölümler" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-brand text-brand" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {item.label}
            <Pending />
          </Link>
        );
      })}
    </nav>
  );
}
