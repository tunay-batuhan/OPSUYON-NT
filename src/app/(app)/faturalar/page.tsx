import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategoryDocuments } from "@/components/category-documents";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Faturalar" };

export default async function InvoicesPage({ searchParams }: PageProps<"/faturalar">) {
  if ((await getCurrentUser())?.kind === "customer") redirect("/cari-hesap/faturalar");
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
