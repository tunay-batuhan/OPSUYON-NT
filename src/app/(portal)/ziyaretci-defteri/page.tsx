import type { Metadata } from "next";
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { VisitorDesk } from "@/components/visitors/visitor-desk";
import { requirePersonnel } from "@/lib/auth";
import { cn } from "@/components/ui";
import { guardProjects, loadDesk } from "@/lib/visitors";
import { ownDeleteSince } from "@/lib/visitor-shared";

export const metadata: Metadata = { title: "Ziyaretçi defteri" };

/**
 * Güvenlik / danışma personelinin ziyaretçi ve kargo defteri (telefon ya da kulübe tableti). Personel, aktif görevli
 * olduğu Güvenlik / Danışma projelerinde kayıt girer; birden çok proje varsa üstte seçer.
 */
export default async function GuardDeskPage({ searchParams }: PageProps<"/ziyaretci-defteri">) {
  const me = await requirePersonnel();
  const projects = await guardProjects(me.personnel_id);
  const sp = await searchParams;
  const asked = typeof sp.proje === "string" ? sp.proje : undefined;
  const project = projects.find((p) => p.id === asked) ?? projects[0];

  if (!project) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <DoorOpen className="mx-auto size-10 text-muted" aria-hidden />
        <p className="mt-3 font-semibold">Ziyaretçi defteri size açık değil</p>
        <p className="mt-1 text-sm text-muted">Defter, Güvenlik ya da Danışma projesinde görevli personele açılır.</p>
      </div>
    );
  }
  const desk = await loadDesk(project.id);
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Ziyaretçi defteri</h1>
      <p className="mt-1 text-sm text-muted">{project.name} · ziyaretçi ve kargo girişlerini buradan kaydedin.</p>
      {projects.length > 1 && (
        <nav aria-label="Proje" className="mt-4 flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/ziyaretci-defteri?proje=${p.id}`}
              aria-current={p.id === project.id ? "page" : undefined}
              className={cn("rounded-full border px-4 py-2 text-sm font-semibold", p.id === project.id ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface")}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-5">
        <VisitorDesk projectId={project.id} desk={desk} myPersonnelId={me.personnel_id} canDeleteAny={false} ownDeleteSince={ownDeleteSince()} />
      </div>
    </>
  );
}
