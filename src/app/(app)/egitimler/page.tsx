import type { Metadata } from "next";
import { PersonnelFile } from "@/components/personnel-file";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Eğitimler" };

/** Personel seçilir; katıldığı tüm eğitimler satır satır listelenir (PDF indir + Görüntüle). */
export default async function TrainingsPage({ searchParams }: PageProps<"/egitimler">) {
  await requireAccess("personel_egitim", "trainings.read");
  return (
    <PersonnelFile
      mode="list"
      category="egitim"
      listLabel="Eğitim"
      emptyText="Bu personel için yüklenmiş eğitim belgesi yok."
      title="Eğitimler"
      description="Üstten personeli seçin; katıldığı tüm eğitimler altta listelenir. PDF indirebilir veya indirmeden Görüntüle ile altta açabilirsiniz."
      path="/egitimler"
      lineNames={await getLineNames()}
      searchParams={await searchParams}
    />
  );
}
