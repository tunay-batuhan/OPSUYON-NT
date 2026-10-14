import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, cn, lineColor, LineIcon } from "@/components/ui";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "Projeler" };

export default async function ProjectsListPage({ searchParams }: PageProps<"/projeler">) {
  const user = await requireUser();
  const { hat } = await searchParams;
  const activeLine = typeof hat === "string" ? hat : undefined;
  if (user.kind === "staff") redirect(activeLine ? `/merkez/projeler?hat=${encodeURIComponent(activeLine)}` : "/merkez/projeler");

  const supabase = await createClient();
  const [lines, { data: projects }, { data: org }] = await Promise.all([
    getServiceLines(),
    supabase.from("projects").select("*").order("name"),
    user.organization_id ? supabase.from("organizations").select("name").eq("id", user.organization_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const all = (projects ?? []) as Project[];
  const available = lines.filter((l) => all.some((p) => p.service_line === l.code));
  const visible = activeLine ? all.filter((p) => p.service_line === activeLine) : all;

  return (
    <>
      <PageHeader
        eyebrow={org?.name}
        title="Projeler"
        description="Yetkilendirildiğiniz projeler aşağıda listelenir."
      />

      {available.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Hizmet alanı filtresi">
          <Link
            href="/projeler"
            className={cn("rounded-full border px-3 py-1 text-sm", !activeLine ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-fg")}
          >
            Tümü
          </Link>
          {available.map((l) => (
            <Link
              key={l.code}
              href={`/projeler?hat=${l.code}`}
              className={cn("rounded-full border px-3 py-1 text-sm", activeLine === l.code ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-fg")}
            >
              {l.name}
            </Link>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            title="Henüz size atanmış bir proje yok"
            description="Merkez projenizi tanımladığında burada görünecek."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const line = lines.find((l) => l.code === p.service_line);
            return (
              <Link
                key={p.id}
                href={`/projeler/${p.id}`}
                className="group rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-lg text-white" style={{ background: lineColor(p.service_line) }} aria-hidden>
                    <LineIcon name={line?.icon} className="size-5" />
                  </span>
                  <Badge tone={p.status === "active" ? "success" : p.status === "paused" ? "warning" : "neutral"}>
                    {p.status === "active" ? "Aktif" : p.status === "paused" ? "Duraklatıldı" : "Kapandı"}
                  </Badge>
                </div>
                <h2 className="mt-4 font-semibold">{p.name}</h2>
                <p className="text-sm text-muted">{line?.name}</p>
                {p.address && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
                    <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {p.address}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
                  Projeyi aç <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
