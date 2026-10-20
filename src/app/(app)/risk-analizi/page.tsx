import type { Metadata } from "next";
import { ServiceDocuments } from "@/components/service-documents";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Risk Analizi" };

/** Merkezin hazırlayıp yüklediği risk analizi raporları: satır satır liste, PDF indirme. */
export default async function RiskAnalysisPage({ searchParams }: PageProps<"/risk-analizi">) {
  await requireAccess("risk_analizi", "risk.read");
  return (
    <ServiceDocuments
      category="risk_analizi"
      title="Risk Analizi"
      description="Merkez tarafından hazırlanıp yüklenen risk analizi raporları. PDF olarak indirebilirsiniz."
      path="/risk-analizi"
      searchParams={await searchParams}
      filters={{ hat: true }}
      emptyText="Henüz risk analizi raporu yüklenmemiş."
    />
  );
}
