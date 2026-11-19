import { redirect } from "next/navigation";

/** Resmi tatiller ekranı kaldırıldı (19 Kasım, müşteri isteği). Eski bağlantı İzin Yönetimi'ne döner. */
export default function HolidaysPage() {
  redirect("/izinler");
}
