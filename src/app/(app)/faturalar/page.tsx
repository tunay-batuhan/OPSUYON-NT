import { redirect } from "next/navigation";

/** Faturalar menüsü kaldırıldı (18 Kasım): faturalar Cari Hesap'ta girilir ve görülür. Eski bağlantılar oraya döner. */
export default function InvoicesPage() {
  redirect("/cari-hesap");
}
