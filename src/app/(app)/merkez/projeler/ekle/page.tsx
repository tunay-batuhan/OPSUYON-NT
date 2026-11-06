import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { ProjectCreateForm } from "@/components/forms/admin-forms";
import { requireStaff } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types";

export const metadata: Metadata = { title: "Proje ekle" };

export default async function ProjectCreatePage({ searchParams }: PageProps<"/merkez/projeler/ekle">) {
  await requireStaff("projects.manage");
  const defaultOrg = str1((await searchParams).firma) ?? "";
  const supabase = await createClient();
  // Yalnızca aktif hizmet alanları: pasif hatta (ör. Kurumsal Tedarik) yeni proje açılamaz
  const [lines, { data: orgs }] = await Promise.all([
    getServiceLines(),
    supabase.from("organizations").select("id, name").eq("status", "active").order("name"),
  ]);

  return (
    <Card>
      <CardHeader
        title="Yeni proje"
        description={`Proje bir firmaya ve bir hizmet alanına (${lines.map((l) => l.name).join(" / ")}) bağlanır.`}
      />
      <ProjectCreateForm
        orgs={((orgs ?? []) as Pick<Organization, "id" | "name">[]).map((o) => ({ value: o.id, label: o.name }))}
        lines={lines.map((l) => ({ value: l.code, label: l.name }))}
        defaultOrg={defaultOrg}
      />
    </Card>
  );
}
