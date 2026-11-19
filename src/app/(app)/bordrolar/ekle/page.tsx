import { redirect } from "next/navigation";

/** “Bordro ekle” kaldırıldı (19 Kasım, müşteri isteği). */
export default function Page() {
  redirect("/bordrolar/maas");
}
