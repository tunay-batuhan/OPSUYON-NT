import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui";
import { PAGE_SIZE, pageCount, pageHref } from "@/lib/paging";

/**
 * Tablo altı sayfalama (10'ar kayıt). Filtreler URL'de kaldığı için bağlantılar onları korur.
 * Kullanım: <Pagination path="/merkez/personel" searchParams={sp} total={count} />
 */
export function Pagination({
  path, searchParams, total, size = PAGE_SIZE, className, hash, param = "sayfa",
}: {
  path: string; searchParams: Record<string, string | string[] | undefined>; total: number; size?: number; className?: string;
  /** Sayfa bağlantısı bu çapaya insin (form üstte olan sayfalarda "liste") */ hash?: string;
  /** Sayfa numarasının adresteki adı; aynı ekrandaki ikinci liste için farklı olmalı (ör. "bsayfa") */ param?: string;
}) {
  const pages = pageCount(total, size);
  const current = Math.min(Math.max(1, Number(typeof searchParams[param] === "string" ? searchParams[param] : 1) || 1), pages);
  if (total <= size) return null;
  const first = (current - 1) * size + 1;
  const last = Math.min(current * size, total);

  // 1 … c-1 c c+1 … N
  const nums = new Set([1, pages, current - 1, current, current + 1].filter((n) => n >= 1 && n <= pages));
  const seq = [...nums].sort((a, b) => a - b);

  const btn = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm";
  return (
    <nav aria-label="Sayfalama" className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm", className)}>
      <p className="text-muted">
        {first}–{last} / {total} kayıt
      </p>
      <div className="flex items-center gap-1">
        {current > 1 ? (
          <Link href={pageHref(path, searchParams, current - 1, hash, param)} aria-label="Önceki sayfa" className={cn(btn, "border-border hover:bg-surface-2")}><ChevronLeft className="size-4" aria-hidden /></Link>
        ) : (
          <span className={cn(btn, "border-border text-muted/50")}><ChevronLeft className="size-4" aria-hidden /></span>
        )}
        {seq.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - seq[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            {n === current ? (
              <span aria-current="page" className={cn(btn, "border-brand bg-brand text-brand-fg")}>{n}</span>
            ) : (
              <Link href={pageHref(path, searchParams, n, hash, param)} className={cn(btn, "border-border hover:bg-surface-2")}>{n}</Link>
            )}
          </span>
        ))}
        {current < pages ? (
          <Link href={pageHref(path, searchParams, current + 1, hash, param)} aria-label="Sonraki sayfa" className={cn(btn, "border-border hover:bg-surface-2")}><ChevronRight className="size-4" aria-hidden /></Link>
        ) : (
          <span className={cn(btn, "border-border text-muted/50")}><ChevronRight className="size-4" aria-hidden /></span>
        )}
      </div>
    </nav>
  );
}
