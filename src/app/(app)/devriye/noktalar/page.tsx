import Link from "next/link";
import type { Metadata } from "next";
import { Printer } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, btn, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { DemoNotice } from "@/components/demo-notice";
import { PatrolPointForm } from "@/components/forms/patrol-forms";
import { requireStaff } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { removePatrolPoint, setPatrolPointActive } from "@/app/actions/patrol";

export const metadata: Metadata = { title: "Devriye Noktaları" };

type Point = { id: string; project_id: string; name: string; code: string; is_active: boolean };

/** Merkez: projelerin devriye noktalarını tanımlar ve barkod/QR etiketlerini yazdırır. */
export default async function PatrolPointsPage({ searchParams }: PageProps<"/devriye/noktalar">) {
  await requireStaff("patrol.manage");
  await requireModule("devriye");
  const sp = await searchParams;
  const projectId = str1(sp.proje);

  const supabase = await createClient();
  const projects = (await getAccessibleProjects()).filter((p) => p.service_line === "guvenlik" || p.service_line === "danisma_tesis");
  let q = supabase.from("patrol_points").select("id, project_id, name, code, is_active").order("sort_order").order("name");
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  const { data } = await q;
  const points = (data ?? []) as Point[];
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));

  const fields: FilterField[] = [{ name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) }];

  return (
    <>
      <PageHeader
        title="Devriye Noktaları"
        description="Projenin devriye noktalarını tanımlayın, her nokta için barkod/QR etiketi yazdırıp noktaya yapıştırın. Görevli telefonundan okutur."
        actions={isUuid(projectId) && points.length > 0 ? (
          <Link href={`/devriye/noktalar/yazdir?proje=${projectId}`} className={btn("primary", "md")}><Printer className="size-4" aria-hidden /> Tüm etiketleri yazdır</Link>
        ) : undefined}
      />
      <DemoNotice />
      <FilterBar action="/devriye/noktalar" fields={fields} />

      <div className="space-y-6">
        <Card>
          <CardHeader title={`${points.length} nokta`} description={isUuid(projectId) ? undefined : "Tüm etiketleri yazdırmak için bir proje seçin."} />
          {points.length === 0 ? (
            <EmptyState title="Henüz devriye noktası yok" description="Aşağıdaki formdan ilk noktayı ekleyin." />
          ) : (
            <Table head={["Nokta", "Proje", "Barkod kodu", "Durum", ""]}>
              {points.map((p) => (
                <tr key={p.id}>
                  <td className={td + " font-medium"}>{p.name}</td>
                  <td className={td}>{nameOf.get(p.project_id) ?? "—"}</td>
                  <td className={td + " font-mono text-xs"}>{p.code}</td>
                  <td className={td}><Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Aktif" : "Pasif"}</Badge></td>
                  <td className={td + " whitespace-nowrap text-right"}>
                    <Link href={`/devriye/noktalar/yazdir?proje=${p.project_id}&nokta=${p.id}`} className="mr-3 text-sm font-medium text-brand hover:underline">Etiketi yazdır</Link>
                    <form action={setPatrolPointActive} className="mr-3 inline">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={p.is_active ? "0" : "1"} />
                      <button className="text-sm text-muted hover:underline">{p.is_active ? "Pasife al" : "Aktifleştir"}</button>
                    </form>
                    <form action={removePatrolPoint} className="inline" title="Okutma kaydı olan nokta silinmez, pasife alınır">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-sm text-danger hover:underline">Sil</button>
                    </form>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Yeni nokta" description="Barkod içeriği otomatik üretilir. Okutma kaydı olan nokta silinmez, pasife alınır." />
          {projects.length === 0 ? (
            <EmptyState title="Devriye için uygun proje yok" description="Devriye, Güvenlik ve Danışma ve Tesis projelerinde kullanılır." />
          ) : (
            <PatrolPointForm projects={projects.map((p) => ({ value: p.id, label: `${p.organizations?.name ?? ""} — ${p.name}` }))} defaultProject={isUuid(projectId) ? projectId : undefined} />
          )}
        </Card>
      </div>
    </>
  );
}
