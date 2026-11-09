import { redirect } from "next/navigation";
import { isUuid, str1 } from "@/lib/lookups";

/** Nokta ekleme artık projenin kendi ekranında (Noktalar ve PIN → proje). */
export default async function PatrolPointAddMovedPage({ searchParams }: PageProps<"/devriye/noktalar/ekle">) {
  const proje = str1((await searchParams).proje);
  redirect(isUuid(proje) ? `/devriye/noktalar/${proje}` : "/devriye/noktalar");
}
