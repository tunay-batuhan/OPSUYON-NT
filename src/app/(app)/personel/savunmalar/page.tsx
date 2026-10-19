import type { Metadata } from "next";
import { PersonnelDocs } from "@/components/personnel-docs";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Personele Savunmalar" };

export default async function DefensesPage({ searchParams }: PageProps<"/personel/savunmalar">) {
  await requireAccess("personel_savunma", "defenses.read");
  return (
    <PersonnelDocs
      category="savunma"
      title="Personele Savunmalar"
      description="Personel adına tıklayınca savunma tutanakları açılır."
      path="/personel/savunmalar"
      mode="expand"
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
