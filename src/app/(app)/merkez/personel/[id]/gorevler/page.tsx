import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, Table, td } from "@/components/ui";
import { EndAssignmentButton } from "@/components/end-assignment-button";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, isoDayInTurkey } from "@/lib/format";

export const metadata: Metadata = { title: "Proje görevlendirmeleri" };

type Assignment = {
  id: string;
  position: string | null;
  start_date: string;
  end_date: string | null;
  projects: { id: string; name: string; organizations: { name: string } | null } | null;
  personnel: { full_name: string } | null;
};

/** Personel detayı › Proje görevlendirmeleri sekmesi (aynı anda en fazla 1 aktif proje). */
export default async function PersonnelAssignmentsPage({ params }: PageProps<"/merkez/personel/[id]/gorevler">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("personnel.read");
  const manage = hasPermission(user, "personnel.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("personnel_assignments")
    .select("id, position, start_date, end_date, projects(id, name, organizations(name)), personnel(full_name)")
    .eq("personnel_id", id)
    .order("start_date", { ascending: false });
  const rows = (data ?? []) as unknown as Assignment[];
  const today = isoDayInTurkey();

  return (
    <Card>
      <CardHeader
        title="Proje görevlendirmeleri"
        description={
          manage
            ? "Bir personel aynı anda yalnızca 1 projede görevli olabilir. Başka projeye atamak için önce aktif görevden alın; atama proje sayfasının Personel sekmesinden yapılır (yalnızca personelin kendi firmasının projelerine). Başka firmaya geçiş: görevden aldıktan sonra Süper Yönetici, Personel kartı sekmesinden firmayı değiştirir."
            : "Bir personel aynı anda yalnızca 1 projede görevli olabilir. Atama ve görevden alma proje sayfasının Personel sekmesinden yapılır."
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Henüz bir projeye atanmamış" />
      ) : (
        <Table head={["Proje", "Firma", "Görev", "Başlangıç", "Bitiş", manage ? "" : null].filter((h) => h !== null)}>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className={td}>{a.projects && <Link href={`/projeler/${a.projects.id}/personel`} className="font-medium hover:text-brand">{a.projects.name}</Link>}</td>
              <td className={td}>{a.projects?.organizations?.name}</td>
              <td className={td}>{a.position ?? "—"}</td>
              <td className={td}>{formatDate(a.start_date)}</td>
              <td className={td}>{a.end_date ? formatDate(a.end_date) : <Badge tone="success">Devam ediyor</Badge>}</td>
              {manage && (
                <td className={td}>
                  <EndAssignmentButton
                    id={a.id}
                    name={a.personnel?.full_name ?? "Bu personel"}
                    project={a.projects?.name}
                    ended={Boolean(a.end_date)}
                    upcoming={a.start_date > today}
                    startLabel={formatDate(a.start_date)}
                  />
                </td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
