import type { Metadata } from "next";
import { PersonnelDocs } from "@/components/personnel-docs";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Savunmalar ve İhtarlar" };

export default async function DefensesPage({ searchParams }: PageProps<"/savunmalar">) {
  await requireAccess("personel_savunma", "defenses.read");
  return (
    <PersonnelDocs
      categories={["savunma", "ihtar"]}
      title="Savunmalar ve İhtarlar"
      description="Personel adına tıklayınca savunma tutanakları ve ihtarlar açılır. PDF indirebilir veya Görüntüle ile altta açabilirsiniz."
      path="/savunmalar"
      mode="expand"
      nameFilter
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
