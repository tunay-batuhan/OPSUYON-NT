import type { Metadata } from "next";
import { PersonnelDocs } from "@/components/personnel-docs";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Yıllık İzinler" };

export default async function AnnualLeavePage({ searchParams }: PageProps<"/personel/izinler">) {
  await requireAccess("personel_izin", "leaves.read");
  return (
    <PersonnelDocs
      category="yillik_izin"
      title="Yıllık İzinler"
      description="İşe giriş, hak edilen, kullanılan ve kalan izin. Personel adına tıklayınca izin formları açılır."
      path="/personel/izinler"
      mode="expand"
      leave
      nameFilter
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
