import type { Metadata } from "next";
import { LedgerEntryPage } from "../entry-page";

export const metadata: Metadata = { title: "Tahsilat girişi" };

/** Cari Hesap → Tahsilat girişi: firmadan yapılan tahsilat kaydı. */
export default function CollectionEntryPage() {
  return <LedgerEntryPage kind="tahsilat" />;
}
