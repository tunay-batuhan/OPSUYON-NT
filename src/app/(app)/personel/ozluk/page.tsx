import type { Metadata } from "next";
import { PersonnelDocs } from "@/components/personnel-docs";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Özlük Dosyaları" };

export default async function PersonnelFilesPage({ searchParams }: PageProps<"/personel/ozluk">) {
  await requireAccess("personel_ozluk", "personnel.files.read");
  return (
    <PersonnelDocs
      category="ozluk"
      title="Özlük Dosyaları"
      description="Hizmete göre personel listesi; özlük dosyalarını PDF olarak indirebilirsiniz."
      path="/personel/ozluk"
      mode="flat"
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
