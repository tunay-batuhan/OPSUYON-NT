import type { Metadata } from "next";
import { EGITIM_SCREEN, PersonnelFileDetail } from "@/components/personnel-file";
import { getLineNames } from "@/lib/lines";
import { requireAccess } from "@/lib/modules";
import { AddTrainingButton } from "../add-training-button";

export const metadata: Metadata = { title: "Eğitimler" };

/** Bir personelin katıldığı tüm eğitimler satır satır (PDF indir + Görüntüle). Merkezde "Eğitim ekle" bu personel seçili açılır. */
export default async function TrainingDetailPage({ params, searchParams }: PageProps<"/egitimler/[id]">) {
  const user = await requireAccess("personel_egitim", "trainings.read");
  const [{ id }, sp, lineNames] = await Promise.all([params, searchParams, getLineNames()]);
  return (
    <PersonnelFileDetail
      screen={EGITIM_SCREEN}
      id={id}
      searchParams={sp}
      lineNames={lineNames}
      actions={<AddTrainingButton user={user} personnelId={id} />}
    />
  );
}
