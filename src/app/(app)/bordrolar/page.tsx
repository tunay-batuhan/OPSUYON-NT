import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategoryDocuments } from "@/components/category-documents";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Bordrolar" };

export default async function PayrollPage({ searchParams }: PageProps<"/bordrolar">) {
  if ((await getCurrentUser())?.kind === "customer") redirect("/personel/bordrolar");
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
