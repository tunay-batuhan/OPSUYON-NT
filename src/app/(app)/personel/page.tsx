import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { requireUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Personel" };

type Row = {
  id: string; position: string | null; shift: string | null; start_date: string; end_date: string | null;
  projects: { id: string; name: string } | null;
  personnel: { id: string; full_name: string; title: string | null; employee_no: string | null } | null;
};

export default async function PersonnelListPage({ searchParams }: PageProps<"/personel">) {
  const user = await requireUser();
  if (user.kind === "staff") redirect("/merkez/personel");
  // Müşteri: Personel menüsü alt ekranlara açılır; ilk açık olana git
  const on = await getEnabledModules();
  const first = [
    ["personel_ozluk", "/personel/ozluk"], ["personel_izin", "/personel/izinler"], ["personel_kiyafet", "/personel/kiyafet"],
  ].find(([m]) => on.has(m));
  if (first) redirect(first[1]);
  const sp = await searchParams;
  const projectId = str1(sp.proje);
  const projects = await getAccessibleProjects();

  const supabase = await createClient();
  let q = supabase
    .from("personnel_assignments")
    .select("id, position, shift, start_date, end_date, projects(id, name), personnel(id, full_name, title, employee_no)")
    .order("start_date", { ascending: false })
    .limit(1000);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  const { data } = await q;
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"));
  const active = rows.filter((r) => !r.end_date).length;

  return (
    <>
      <PageHeader title="Personel" description="Projelerinizde görevli personel." />
      <FilterBar action="/personel" fields={[{ name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) }]} />
      <Card>
        <CardHeader title={`${active} aktif görevlendirme`} description={`${rows.length} kayıt`} />
        {rows.length === 0 ? (
          <EmptyState title="Personel bulunamadı" />
        ) : (
          <Table head={["Personel", "Proje", "Görev", "Vardiya", "Başlangıç", "Durum"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <p className="font-medium">{r.personnel?.full_name}</p>
                  {r.personnel?.employee_no && <p className="text-xs text-muted">Sicil: {r.personnel.employee_no}</p>}
                </td>
                <td className={td}>{r.projects && <Link href={`/projeler/${r.projects.id}/personel`} className="hover:text-brand">{r.projects.name}</Link>}</td>
                <td className={td}>{r.position ?? r.personnel?.title ?? "—"}</td>
                <td className={td}>{r.shift ?? "—"}</td>
                <td className={td}>{formatDate(r.start_date)}</td>
                <td className={td}><Badge tone={r.end_date ? "neutral" : "success"}>{r.end_date ? "Ayrıldı" : "Aktif"}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
