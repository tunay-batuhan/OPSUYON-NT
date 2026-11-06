import type { Metadata } from "next";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { PatrolPointForm } from "@/components/forms/patrol-forms";
import { requireStaff } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { PATROL_LINES } from "../lines";

export const metadata: Metadata = { title: "Yeni devriye noktası" };

export default async function PatrolPointAddPage({ searchParams }: PageProps<"/devriye/noktalar/ekle">) {
  await requireStaff("patrol.manage");
  await requireModule("devriye");
  const sp = await searchParams;
  const projectId = str1(sp.proje);
  const projects = (await getAccessibleProjects()).filter((p) => PATROL_LINES.includes(p.service_line));

  return (
    <>
      <Card>
        <CardHeader title="Yeni nokta" description="Okutma kaydı olan nokta silinmez, pasife alınır." />
        {projects.length === 0 ? (
          <EmptyState title="Devriye için uygun proje yok" description="Devriye; Güvenlik, Danışma ve Tesis Yönetimi projelerinde kullanılır." />
        ) : (
          <PatrolPointForm projects={projects.map((p) => ({ value: p.id, label: `${p.organizations?.name ?? ""} — ${p.name}` }))} defaultProject={isUuid(projectId) ? projectId : undefined} />
        )}
      </Card>
    </>
  );
}
