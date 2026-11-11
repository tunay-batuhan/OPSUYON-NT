import type { Metadata } from "next";
import { LedgerEntryPage } from "../entry-page";

export const metadata: Metadata = { title: "Fatura girişi" };

/** Cari Hesap → Fatura girişi: firmaya fatura (genel toplam) kaydı. */
export default function InvoiceEntryPage() {
  return <LedgerEntryPage kind="fatura" />;
}
