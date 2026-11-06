import type { Metadata } from "next";
import { EGITIM_SCREEN, PersonnelFileList } from "@/components/personnel-file";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";

export const metadata: Metadata = { title: "Eğitimler" };

/** Aktif personel listesi (Hizmet + Ad soyad filtresi, eğitim sayısı); personele tıklayınca eğitimleri açılır (/egitimler/[id]). */
export default async function TrainingsPage({ searchParams }: PageProps<"/egitimler">) {
  await requireAccess("personel_egitim", "trainings.read");
  return <PersonnelFileList screen={EGITIM_SCREEN} lineNames={await getLineNames()} searchParams={await searchParams} />;
}
