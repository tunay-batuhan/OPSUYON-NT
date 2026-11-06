import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OZLUK_SCREEN, PersonnelFileDetail } from "@/components/personnel-file";
import { canAnywhere, getCurrentUser } from "@/lib/auth";
import { getLineNames } from "@/lib/lines";
import { requireModule } from "@/lib/modules";

export const metadata: Metadata = { title: "Özlük Evrakları" };

/** Bir personelin özlük evrakları, müşterinin istediği sırayla (iş sözleşmesi, İSG, kimlik, ikametgah, adli sicil, sağlık raporu, onam formları). */
export default async function PersonnelFileDetailPage({ params, searchParams }: PageProps<"/personel/ozluk/[id]">) {
  await requireModule("personel_ozluk");
  const user = await getCurrentUser();
  if (!user || !(canAnywhere(user, "personnel.files.read") || canAnywhere(user, "contracts.read"))) notFound();
  const [{ id }, sp, lineNames] = await Promise.all([params, searchParams, getLineNames()]);
  return <PersonnelFileDetail screen={OZLUK_SCREEN} id={id} searchParams={sp} lineNames={lineNames} />;
}
