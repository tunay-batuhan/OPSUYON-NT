import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { yearOptions } from "@/components/filter-bar";
import { RiskUploadForm } from "@/components/forms/ops-upload-forms";
import { requireStaff } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/lookups";

export const metadata: Metadata = { title: "Risk analizi ekle" };

/** Proje + dönem seçilip risk analizi raporu yüklenir; başlık otomatik "Risk Analizi AA/YYYY – Proje adı". */
export default async function RiskAddPage() {
  await requireStaff("documents.manage");
  const projects = await getAccessibleProjects();
  const now = new Date();

  return (
    <Card>
      <CardHeader
        title="Risk analizi ekle"
        description="Projeyi ve dönemi seçin, raporu yükleyin. Başlık otomatik oluşur; müşteri, işaretliyse Risk Analizi ekranında görür."
      />
      <RiskUploadForm
        projects={projects.map((p) => ({ value: p.id, label: p.name }))}
        years={yearOptions()}
        month={now.getMonth() + 1}
        year={now.getFullYear()}
      />
    </Card>
  );
}
