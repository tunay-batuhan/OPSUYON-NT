import { redirect } from "next/navigation";

/** Sekme kalktı: tüm sözleşmeler Özlük Evrakları altında (1. sırada Personel İş Sözleşmesi). */
export default async function ContractsMovedPage({ searchParams }: PageProps<"/personel/sozlesmeler">) {
  const sp = await searchParams;
  redirect(typeof sp.hat === "string" && sp.hat ? `/personel/ozluk?hat=${encodeURIComponent(sp.hat)}` : "/personel/ozluk");
}
