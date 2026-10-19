import type { Metadata } from "next";
import { ServiceDocuments } from "@/components/service-documents";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Bordrolar" };

export default async function PayrollBulkPage({ searchParams }: PageProps<"/personel/bordrolar">) {
  await requireAccess("personel_bordro", "payroll.read");
  return (
    <ServiceDocuments
      category="bordro"
      title="Bordrolar"
      description="Bordrolar hizmet bazında toplu olarak yüklenir. Hizmeti seçin, bordroyu PDF olarak indirin."
      path="/personel/bordrolar"
      searchParams={await searchParams}
      filters={{ hat: true, period: true }}
      emptyText="Seçtiğiniz hizmet ve dönem için bordro yüklenmemiş."
    />
  );
}
