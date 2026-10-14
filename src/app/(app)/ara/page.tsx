import Link from "next/link";
import type { Metadata } from "next";
import { FileText, FolderKanban, Search, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { str1 } from "@/lib/lookups";

export const metadata: Metadata = { title: "Ara" };

export default async function SearchPage({ searchParams }: PageProps<"/ara">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (str1(sp.q) ?? "").trim().slice(0, 60);
  const like = `%${q.replace(/[%_\\]/g, " ").trim()}%`;

  const supabase = await createClient();
  const [projects, personnel, docs] = q.length >= 2
    ? await Promise.all([
        supabase.from("projects").select("id, name, organizations(name)").ilike("name", like).limit(8),
        supabase.from("personnel").select("id, full_name, title").ilike("full_name", like).limit(8),
        supabase.from("documents").select("id, title, project_id, projects(name)").ilike("title", like).limit(8),
      ])
    : [null, null, null];

  const pr = (projects?.data ?? []) as unknown as { id: string; name: string; organizations: { name: string } | null }[];
  const pe = (personnel?.data ?? []) as { id: string; full_name: string; title: string | null }[];
  const dc = (docs?.data ?? []) as unknown as { id: string; title: string; project_id: string; projects: { name: string } | null }[];

  return (
    <>
      <PageHeader title="Ara" description="Proje, personel ve belge arayın." />
      <form action="/ara" className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input name="q" defaultValue={q} autoFocus placeholder="En az 2 karakter…" aria-label="Arama" className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
      </form>

      {q.length < 2 ? (
        <Card><EmptyState title="Aramaya başlayın" description="Proje adı, personel adı veya belge başlığı yazın." /></Card>
      ) : pr.length + pe.length + dc.length === 0 ? (
        <Card><EmptyState title={`"${q}" için sonuç yok`} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Results title="Projeler" icon={<FolderKanban className="size-4" aria-hidden />} items={pr.map((p) => ({ id: p.id, href: `/projeler/${p.id}`, label: p.name, sub: p.organizations?.name }))} />
          <Results title="Personel" icon={<Users className="size-4" aria-hidden />} items={pe.map((p) => ({ id: p.id, href: user.kind === "staff" ? `/merkez/personel/${p.id}` : "/personel", label: p.full_name, sub: p.title ?? undefined }))} />
          <Results title="Belgeler" icon={<FileText className="size-4" aria-hidden />} items={dc.map((d) => ({ id: d.id, href: `/projeler/${d.project_id}/belgeler`, label: d.title, sub: d.projects?.name }))} />
        </div>
      )}
    </>
  );
}

function Results({ title, icon, items }: { title: string; icon: React.ReactNode; items: { id: string; href: string; label: string; sub?: string }[] }) {
  return (
    <Card>
      <CardHeader title={title} description={`${items.length} sonuç`} action={<span className="text-muted">{icon}</span>} />
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Sonuç yok</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="block px-5 py-3 hover:bg-surface-2">
                <span className="font-medium">{i.label}</span>
                {i.sub && <span className="block text-xs text-muted">{i.sub}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
