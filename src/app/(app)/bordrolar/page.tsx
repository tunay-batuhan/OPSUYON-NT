import { redirect } from "next/navigation";

/** Yüklenen bordro dosyaları ekranı kaldırıldı (19 Kasım): bordro artık Maaş bordrosu sekmesinde hazırlanır ve onaylanınca görülür. */
export default function Page() {
  redirect("/bordrolar/maas");
}
