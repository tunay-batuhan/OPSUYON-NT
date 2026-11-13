import type { Metadata } from "next";
import { EGITIM_SCREEN, PersonnelFileList } from "@/components/personnel-file";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";
import { AddTrainingButton } from "./add-training-button";

export const metadata: Metadata = { title: "Eğitimler" };

/**
 * Aktif personel listesi (Hizmet + Ad soyad filtresi, eğitim sayısı); personele tıklayınca eğitimleri açılır (/egitimler/[id]).
 * Müşteride yalnızca görüntüleme; merkezde (evrak yükleme yetkisi varsa) sağ üstte "Eğitim ekle".
 */
export default async function TrainingsPage({ searchParams }: PageProps<"/egitimler">) {
  const user = await requireAccess("personel_egitim", "trainings.read");
  return (
    <PersonnelFileList
      screen={EGITIM_SCREEN}
      lineNames={await getLineNames()}
      searchParams={await searchParams}
      actions={<AddTrainingButton user={user} />}
    />
  );
}
