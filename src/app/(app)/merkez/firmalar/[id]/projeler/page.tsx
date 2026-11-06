import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, Table, td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAllServiceLines } from "@/lib/lines";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "Firma projeleri" };

/** Firma detayı › Projeler sekmesi. */
export default async function OrganizationProjectsPage({ params }: PageProps<"/merkez/firmalar/[id]/projeler">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireStaff("organizations.read");
  const supabase = await createClient();
  const [{ data }, lines] = await Promise.all([
    supabase.from("projects").select("*").eq("organization_id", id).order("name"),
    getAllServiceLines(),
  ]);
  const prj = (data ?? []) as Project[];

  return (
    <Card>
      <CardHeader title="Projeler" description={`${prj.length} proje`} />
      {prj.length === 0 ? (
        <EmptyState title="Bu firmanın projesi yok" />
      ) : (
        <Table head={["Proje", "Hizmet alanı", "Bitiş", "Durum"]}>
          {prj.map((p) => (
            <tr key={p.id}>
              <td className={td}><Link href={`/projeler/${p.id}`} className="font-medium hover:text-brand">{p.name}</Link></td>
              <td className={td}>{lines.find((l) => l.code === p.service_line)?.name ?? p.service_line}</td>
              <td className={td}>{formatDate(p.end_date)}</td>
              <td className={td}><Badge tone={p.status === "active" ? "success" : p.status === "paused" ? "warning" : "neutral"}>{p.status === "active" ? "Aktif" : p.status === "paused" ? "Duraklatıldı" : "Pasif"}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
