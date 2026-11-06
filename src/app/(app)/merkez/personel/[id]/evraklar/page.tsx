import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonnelDocuments } from "@/components/personnel-documents";
import { hasPermission, requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Personel evrakları" };

/** Personel detayı › Evraklar sekmesi: türe göre gruplu, filtreli. */
export default async function PersonnelDocsPage({ params, searchParams }: PageProps<"/merkez/personel/[id]/evraklar">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("personnel.read");
  const uploadHref = hasPermission(user, "documents.manage") ? `/merkez/personel/evrak-ekle?personel=${id}` : undefined;
  return <PersonnelDocuments personnelId={id} user={user} searchParams={await searchParams} uploadHref={uploadHref} />;
}
