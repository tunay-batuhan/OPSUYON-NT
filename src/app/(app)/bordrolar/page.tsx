import type { Metadata } from "next";
import { CategoryDocuments } from "@/components/category-documents";

export const metadata: Metadata = { title: "Bordrolar" };

export default async function PayrollPage({ searchParams }: PageProps<"/bordrolar">) {
  return (
    <CategoryDocuments
      category="bordro"
      title="Bordrolar"
      description="Aylık personel bordroları. Dönem ve projeye göre filtreleyebilirsiniz."
      path="/bordrolar"
      periodic
      searchParams={await searchParams}
    />
  );
}
