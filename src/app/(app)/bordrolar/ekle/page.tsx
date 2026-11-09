import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { yearOptions } from "@/components/filter-bar";
import { PayrollUploadForm } from "@/components/forms/ops-upload-forms";
import { requireStaff } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/lookups";

export const metadata: Metadata = { title: "Bordro ekle" };

/** Proje + dönem seçilip bordro dosyası yüklenir; başlık otomatik "Bordro AA/YYYY – Proje adı". */
export default async function PayrollAddPage() {
  await requireStaff("documents.manage");
  const projects = await getAccessibleProjects();
  const now = new Date();

  return (
    <Card>
      <CardHeader
        title="Bordro ekle"
        description="Projeyi ve dönemi seçin, bordro dosyasını yükleyin. Başlık otomatik oluşur; müşteri, işaretliyse Bordrolar ekranında görür."
      />
      <PayrollUploadForm
        projects={projects.map((p) => ({ value: p.id, label: p.name }))}
        years={yearOptions()}
        month={now.getMonth() + 1}
        year={now.getFullYear()}
      />
    </Card>
  );
}
