import type { Metadata } from "next";
import { CategoryDocuments } from "@/components/category-documents";
import { ServiceDocuments } from "@/components/service-documents";
import { getCurrentUser } from "@/lib/auth";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Bordrolar" };

export default async function PayrollPage({ searchParams }: PageProps<"/bordrolar">) {
  const sp = await searchParams;
  if ((await getCurrentUser())?.kind === "customer") {
    await requireAccess("personel_bordro", "payroll.read");
    return (
      <ServiceDocuments
        category="bordro"
        title="Bordrolar"
        description="Bordrolar hizmet bazında toplu olarak yüklenir. Hizmet, ay ve yılı seçin; bordroyu PDF olarak indirin veya altta görüntüleyin."
        path="/bordrolar"
        searchParams={sp}
        filters={{ hat: true, period: true }}
        preview
        emptyText="Seçtiğiniz hizmet ve dönem için bordro yüklenmemiş."
      />
    );
  }
  return (
    <CategoryDocuments
      category="bordro"
      title="Bordrolar"
      description="Aylık personel bordroları. Dönem ve projeye göre filtreleyebilirsiniz."
      path="/bordrolar"
      periodic
      searchParams={sp}
    />
  );
}
