import type { Metadata } from "next";
import { PersonnelDocs } from "@/components/personnel-docs";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Personel Sözleşmeleri" };

export default async function ContractsPage({ searchParams }: PageProps<"/personel/sozlesmeler">) {
  await requireAccess("personel_sozlesme", "contracts.read");
  return (
    <PersonnelDocs
      category="sozlesme"
      title="Personel Sözleşmeleri"
      description="Hizmete göre personel listesi; sözleşmeleri PDF olarak indirebilirsiniz."
      path="/personel/sozlesmeler"
      mode="flat"
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
