import { Bone } from "@/components/skeletons";
import { RouteProgress } from "@/components/nav-progress";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Yükleniyor" className="space-y-4">
      <RouteProgress />
      <Bone className="h-8 w-48" />
      <Bone className="h-4 w-64" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
          <Bone className="h-6 w-32" />
          <Bone className="h-9 w-40" />
          <div className="grid grid-cols-2 gap-3">
            <Bone className="h-14" />
            <Bone className="h-14" />
          </div>
        </div>
      ))}
      <span className="sr-only">Yükleniyor…</span>
    </div>
  );
}
