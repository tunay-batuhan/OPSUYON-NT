import type { Metadata } from "next";
import { ServiceDocuments } from "@/components/service-documents";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Faturalar" };

export default async function InvoiceDocsPage({ searchParams }: PageProps<"/cari-hesap/faturalar">) {
  await requireAccess("cari_faturalar", "invoices.read");
  return (
    <ServiceDocuments
      category="fatura"
      title="Faturalar"
      description="Ay ve yıl seçin; o döneme ait faturayı PDF olarak indirin."
      path="/cari-hesap/faturalar"
      searchParams={await searchParams}
      filters={{ hat: false, project: false, period: true }}
      emptyText="Seçtiğiniz döneme ait fatura yüklenmemiş."
    />
  );
}
