import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { TemplateEditor } from "@/components/payroll/template-editor";
import { hasPermission } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { loadTemplate, requirePayrollAccess } from "@/lib/payroll";

export const metadata: Metadata = { title: "Bordro şablonu" };

/**
 * Bordro şablonu (yalnızca merkez, payroll.manage): maaş tablosunun sütunları ve formülleri. "Varsayılan" şablon özel
 * şablonu olmayan tüm projelerde geçerlidir; bir proje seçilirse o projeye özel şablon kaydedilir.
 */
export default async function PayrollTemplatePage({ searchParams }: PageProps<"/bordrolar/sablon">) {
  const user = await requirePayrollAccess(["payroll.manage"]);
  if (user.kind !== "staff" || !hasPermission(user, "payroll.manage")) notFound();
  const sp = await searchParams;
  const projects = await getAccessibleProjects();
  const asked = str1(sp.proje);
  const project = isUuid(asked) ? projects.find((p) => p.id === asked) : undefined;
  const { columns, source } = await loadTemplate(project?.id ?? null);
  return (
    <>
      <FilterBar
        action="/bordrolar/sablon"
        fields={[
          {
            name: "proje", label: "Şablon", value: project?.id, all: "Varsayılan (tüm projeler)",
            options: projects.map((p) => ({ value: p.id, label: p.organizations ? `${p.name} · ${p.organizations.name}` : p.name })), searchable: projects.length > 8,
          },
        ]}
      />
      <Card>
        <CardHeader title="Maaş tablosu sütunları ve formüller" description="Sütun ekleyin, sırasını değiştirin, formülleri düzenleyin. Kaydedilen şablon yeni başlatılan dönemlerde kullanılır; açık taslakta “Şablonu yenile”ye basın." />
        <TemplateEditor key={project?.id ?? "varsayilan"} projectId={project?.id ?? null} projectName={project?.name ?? null} initial={columns} source={source} />
      </Card>
    </>
  );
}
