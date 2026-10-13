import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td, lineColor } from "@/components/ui";
import { ProjectCreateForm } from "@/components/forms/admin-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Project } from "@/lib/types";

export const metadata: Metadata = { title: "Projeler" };

export default async function ProjectsPage({ searchParams }: PageProps<"/merkez/projeler">) {
  const sp = await searchParams;
  const defaultOrg = typeof sp.firma === "string" ? sp.firma : "";
  const user = await requireStaff("projects.read");
  const supabase = await createClient();
  const [lines, { data: projects }, { data: orgs }] = await Promise.all([
    getServiceLines(),
    supabase.from("projects").select("*, organizations(id, name)").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name").eq("status", "active").order("name"),
  ]);
  const list = (projects ?? []) as Project[];
  const manage = hasPermission(user, "projects.manage");

  return (
    <>
      <PageHeader title="Projeler" description="Her proje bir firmaya ve bir hizmet alanına bağlıdır." />
      <div className="space-y-6">
        <Card>
          {list.length === 0 ? (
            <EmptyState title="Henüz proje yok" />
          ) : (
            <Table head={["Proje", "Firma", "Hizmet alanı", "Durum"]}>
              {list.map((p) => {
                const line = lines.find((l) => l.code === p.service_line);
                return (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/projeler/${p.id}`} className="font-medium hover:text-brand">{p.name}</Link>
                      {p.code && <p className="text-xs text-muted">{p.code}</p>}
                    </td>
                    <td className={td}>{p.organizations?.name}</td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: lineColor(p.service_line) }} aria-hidden />
                        {line?.name ?? p.service_line}
                      </span>
                    </td>
                    <td className={td}>
                      <Badge tone={p.status === "active" ? "success" : p.status === "paused" ? "warning" : "neutral"}>
                        {p.status === "active" ? "Aktif" : p.status === "paused" ? "Duraklatıldı" : "Kapandı"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>

        {manage && (
          <Card id="yeni">
            <CardHeader title="Yeni proje" description="Proje bir firmaya ve bir hizmet alanına (Güvenlik / Temizlik / Kurumsal Tedarik) bağlanır." />
            <ProjectCreateForm
              orgs={((orgs ?? []) as Pick<Organization, "id" | "name">[]).map((o) => ({ value: o.id, label: o.name }))}
              lines={lines.map((l) => ({ value: l.code, label: l.name }))}
              defaultOrg={defaultOrg}
            />
          </Card>
        )}
      </div>
    </>
  );
}
