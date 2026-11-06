import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OZLUK_SCREEN, PersonnelFileList } from "@/components/personnel-file";
import { SectionTabs } from "@/components/section-tabs";
import { canAnywhere, getCurrentUser } from "@/lib/auth";
import { getLineNames } from "@/lib/lines";
import { requireModule } from "@/lib/modules";

export const metadata: Metadata = { title: "Özlük Evrakları" };

/** Aktif personel listesi (Hizmet + Ad soyad filtresi); personele tıklayınca evrakları sırayla açılır (/personel/ozluk/[id]). */
export default async function PersonnelFilesPage({ searchParams }: PageProps<"/personel/ozluk">) {
  await requireModule("personel_ozluk");
  const user = await getCurrentUser();
  if (!user || !(canAnywhere(user, "personnel.files.read") || canAnywhere(user, "contracts.read"))) notFound();
  return (
    <PersonnelFileList
      screen={OZLUK_SCREEN}
      lineNames={await getLineNames()}
      searchParams={await searchParams}
      section={{ title: "Personel", tabs: <SectionTabs section="personel" /> }}
    />
  );
}
