// Firma bazlı cari hesap (11 Kasım): fatura girişi ve tahsilat girişi. Tarayıcıda (react-hook-form) ve
// sunucuda (action içinde) AYNI şema çalışır.
import { z } from "zod";
import { date, decimal, opt, uuid } from "@/lib/schemas";

export type LedgerKind = "fatura" | "tahsilat";

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = { fatura: "Fatura", tahsilat: "Tahsilat" };

/** Tutar alanının etiketi: faturada "Genel toplam", tahsilatta "Tahsilat tutarı". */
export const ledgerAmountLabel = (kind: LedgerKind) => (kind === "fatura" ? "Genel toplam" : "Tahsilat tutarı");

/** numeric(14,2) üst sınırı */
const MAX_AMOUNT = 999_999_999_999;

export const ledgerEntrySchema = (kind: LedgerKind) => {
  const prefix = kind === "fatura" ? "Fatura" : "Tahsilat";
  return z.object({
    kind: z.literal(kind),
    organization_id: uuid("Firma"),
    entry_date: date(`${prefix} tarihi`, true),
    entry_time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${prefix} saati SS:DD biçiminde olmalı`),
    description: opt("Açıklama", 500),
    amount: decimal(ledgerAmountLabel(kind), { required: true, min: 0.01, max: MAX_AMOUNT }),
  });
};

export type LedgerEntryValues = z.infer<ReturnType<typeof ledgerEntrySchema>>;
