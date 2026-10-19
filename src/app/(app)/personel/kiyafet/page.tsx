import type { Metadata } from "next";
import { PersonnelDocs } from "@/components/personnel-docs";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Kıyafet ve Ekipman" };

export default async function UniformPage({ searchParams }: PageProps<"/personel/kiyafet">) {
  await requireAccess("personel_kiyafet", "uniform.read");
  return (
    <PersonnelDocs
      category="kiyafet_ekipman"
      title="Kıyafet ve Ekipman"
      description="Personel adına tıklayınca kıyafet ve ekipman teslim tutanakları açılır."
      path="/personel/kiyafet"
      mode="expand"
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
