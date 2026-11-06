import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { InspectionUploadForm } from "@/components/forms/ops-upload-forms";
import { requireStaff } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/lookups";
import { InspectionTabs } from "../tabs";

export const metadata: Metadata = { title: "Yeni denetim ekle" };

/** Proje, denetim günü ve vardiya seçilip rapor yüklenir; başlık "Denetim Raporu GG.AA.YYYY Gece/Gündüz – Proje". */
export default async function InspectionAddPage() {
  await requireStaff("documents.manage");
  const projects = await getAccessibleProjects();

  return (
    <>
      <PageHeader title="Denetimler" description="Yapılan denetimlerin raporları." />
      <InspectionTabs manage />
      <Card>
        <CardHeader
          title="Yeni denetim ekle"
          description="Projeyi, denetim tarihini ve vardiyayı seçip raporu yükleyin. Başlık otomatik oluşur; dönem denetim tarihinden alınır."
        />
        <InspectionUploadForm projects={projects.map((p) => ({ value: p.id, label: p.name }))} />
      </Card>
    </>
  );
}
