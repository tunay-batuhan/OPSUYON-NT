import { redirect } from "next/navigation";

/** Faturalar sekmesi kaldırıldı (18 Kasım): fatura ve dosyası Cari Hesap hareketlerinde görülür. */
export default function InvoiceDocsPage() {
  redirect("/cari-hesap");
}
