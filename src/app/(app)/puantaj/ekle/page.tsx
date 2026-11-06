import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { yearOptions } from "@/components/filter-bar";
import { TimesheetUploadForm } from "@/components/forms/ops-upload-forms";
import { requireStaff } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/lookups";
import { TimesheetTabs } from "../tabs";

export const metadata: Metadata = { title: "Puantaj ekle" };

/** Proje + dönem seçilip puantaj dosyası yüklenir; başlık otomatik "Puantaj AA/YYYY – Proje adı". */
export default async function TimesheetAddPage() {
  await requireStaff("documents.manage");
  const projects = await getAccessibleProjects();
  const now = new Date();

  return (
    <>
      <PageHeader title="Puantaj" description="Tüm projelerin puantaj dosyaları. PDF indirebilir veya indirmeden Görüntüle ile açabilirsiniz." />
      <TimesheetTabs manage />
      <Card>
        <CardHeader
          title="Puantaj ekle"
          description="Projeyi ve dönemi seçin, puantaj dosyasını yükleyin. Başlık otomatik oluşur; müşteri, işaretliyse Puantaj ekranında görür."
        />
        <TimesheetUploadForm
          projects={projects.map((p) => ({ value: p.id, label: p.name }))}
          years={yearOptions()}
          month={now.getMonth() + 1}
          year={now.getFullYear()}
        />
      </Card>
    </>
  );
}
