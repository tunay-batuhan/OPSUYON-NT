import { cn } from "@/components/ui";

export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-border/70", className)} />;
}

/** Generic page placeholder: title + stat tiles + table card. */
export function PageSkeleton({ stats = true }: { stats?: boolean }) {
  return (
    <div role="status" aria-busy="true" aria-label="Yükleniyor" className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-4 w-40" />
        <Bone className="h-8 w-72" />
      </div>
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <Bone className="h-4 w-24" />
              <Bone className="mt-3 h-8 w-16" />
            </div>
          ))}
        </div>
      )}
      <TableSkeleton />
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-5 py-4">
        <Bone className="h-5 w-44" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Bone className="h-4 w-1/4" />
            <Bone className="h-4 w-1/6" />
            <Bone className="hidden h-4 w-1/6 sm:block" />
            <Bone className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
