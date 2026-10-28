import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonnelFile } from "@/components/personnel-file";
import { canAnywhere } from "@/lib/auth";
import { getLineNames } from "@/lib/lines";
import { requireModule } from "@/lib/modules";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Özlük Evrakları" };

/** Personel seçilir; evrakları sırayla listelenir (iş sözleşmesi, İSG, kimlik, ikametgah, adli sicil, sağlık raporu, onam formları). */
export default async function PersonnelFilesPage({ searchParams }: PageProps<"/personel/ozluk">) {
  await requireModule("personel_ozluk");
  const user = await getCurrentUser();
  if (!user || !(canAnywhere(user, "personnel.files.read") || canAnywhere(user, "contracts.read"))) notFound();
  return (
    <PersonnelFile
      mode="checklist"
      title="Özlük Evrakları"
      description="Üstten personeli seçin; evrakları sırayla altta listelenir. Her evrak için PDF indirebilir veya indirmeden Görüntüle ile altta açabilirsiniz."
      path="/personel/ozluk"
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
