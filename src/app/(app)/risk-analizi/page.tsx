import type { Metadata } from "next";
import { ServiceDocuments } from "@/components/service-documents";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Risk Analizi" };

/** Merkezin hazırlayıp yüklediği risk analizi raporları: satır satır liste, PDF indirme; merkez satırda silebilir. */
export default async function RiskAnalysisPage({ searchParams }: PageProps<"/risk-analizi">) {
  const user = await requireAccess("risk_analizi", "risk.read");
  const staff = user.kind === "staff";
  return (
    <ServiceDocuments
      category="risk_analizi"
      title="Risk Analizi"
      description=""
      headless
      path="/risk-analizi"
      searchParams={await searchParams}
      filters={staff ? { hat: true, project: true, period: true } : { hat: true }}
      deletable={staff}
      emptyText={staff ? "Henüz risk analizi raporu yüklenmemiş. “Risk analizi ekle” sekmesinden ekleyebilirsiniz." : "Henüz risk analizi raporu yüklenmemiş."}
    />
  );
}
