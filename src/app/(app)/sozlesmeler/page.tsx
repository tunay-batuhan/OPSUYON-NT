import type { Metadata } from "next";
import { CategoryDocuments } from "@/components/category-documents";

export const metadata: Metadata = { title: "Sözleşmeler" };

export default async function ContractsPage({ searchParams }: PageProps<"/sozlesmeler">) {
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
