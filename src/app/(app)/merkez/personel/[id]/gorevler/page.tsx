import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, Table, td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Proje görevlendirmeleri" };

type Assignment = {
  id: string;
  position: string | null;
  start_date: string;
  end_date: string | null;
  projects: { id: string; name: string; organizations: { name: string } | null } | null;
};

/** Personel detayı › Proje görevlendirmeleri sekmesi (aynı anda en fazla 1 aktif proje). */
export default async function PersonnelAssignmentsPage({ params }: PageProps<"/merkez/personel/[id]/gorevler">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireStaff("personnel.read");
  const supabase = await createClient();
  const { data } = await supabase
    .from("personnel_assignments")
    .select("id, position, start_date, end_date, projects(id, name, organizations(name))")
    .eq("personnel_id", id)
    .order("start_date", { ascending: false });
  const rows = (data ?? []) as unknown as Assignment[];

  return (
    <Card>
      <CardHeader title="Proje görevlendirmeleri" description="Bir personel aynı anda yalnızca 1 projede görevli olabilir. Atama ve görevden alma proje sayfasının Personel sekmesinden yapılır." />
      {rows.length === 0 ? (
        <EmptyState title="Henüz bir projeye atanmamış" />
      ) : (
        <Table head={["Proje", "Firma", "Görev", "Başlangıç", "Bitiş"]}>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className={td}>{a.projects && <Link href={`/projeler/${a.projects.id}/personel`} className="font-medium hover:text-brand">{a.projects.name}</Link>}</td>
              <td className={td}>{a.projects?.organizations?.name}</td>
              <td className={td}>{a.position ?? "—"}</td>
              <td className={td}>{formatDate(a.start_date)}</td>
              <td className={td}>{a.end_date ? formatDate(a.end_date) : <Badge tone="success">Devam ediyor</Badge>}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
