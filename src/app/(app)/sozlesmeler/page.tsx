import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategoryDocuments } from "@/components/category-documents";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sözleşmeler" };

export default async function ContractsPage({ searchParams }: PageProps<"/sozlesmeler">) {
  if ((await getCurrentUser())?.kind === "customer") redirect("/personel/sozlesmeler");
  return (
    <CategoryDocuments
      category="sozlesme"
      title="Sözleşmeler"
      description="Personel sözleşmeleri. Görüntüleyip indirebilirsiniz."
      path="/sozlesmeler"
      searchParams={await searchParams}
    />
  );
}
