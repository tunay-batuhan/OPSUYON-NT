import type { Metadata } from "next";
import { CategoryDocuments } from "@/components/category-documents";

export const metadata: Metadata = { title: "Faturalar" };

export default async function InvoicesPage({ searchParams }: PageProps<"/faturalar">) {
  return (
    <CategoryDocuments
      category="fatura"
      title="Faturalar"
      description="Aylık kesilen faturalar (PDF). Cari bakiye için Cari Hesap sayfasına bakın."
      path="/faturalar"
      periodic
      searchParams={await searchParams}
    />
  );
}
