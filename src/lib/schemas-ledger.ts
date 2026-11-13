// Firma bazlı cari hesap (11 Kasım): fatura girişi ve tahsilat girişi. Tarayıcıda (react-hook-form) ve
// sunucuda (action içinde) AYNI şema çalışır.
import { z } from "zod";
import { date, money, opt, uuid } from "@/lib/schemas";

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
    amount: money(ledgerAmountLabel(kind), { required: true, min: 0.01, max: MAX_AMOUNT }),
    // İsteğe bağlı dosya (fatura PDF'i / görseli, tahsilat dekontu): tarayıcı önce imzalı adresle yükler, yolu buraya yazar
    file_path: z.string().max(400),
    file_name: z.string().max(255),
  });
};

/** Dosya alanının etiketi: faturada "Fatura dosyası / görseli", tahsilatta "Dekont". */
export const ledgerFileLabel = (kind: LedgerKind) => (kind === "fatura" ? "Fatura dosyası / görseli" : "Dekont");

/** Cari dosyası: PDF ya da görsel, en fazla 50 MB (Storage kovasının sınırı). */
export const LEDGER_FILE_MAX = 50 * 1024 * 1024;
export const LEDGER_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
/** Dosya seçicinin `accept` değeri (iPhone'da HEIC fotoğraf bu listeyle JPEG'e çevrilerek gelir). */
export const LEDGER_FILE_ACCEPT = "application/pdf,.pdf,image/jpeg,image/png,image/webp,image/gif";
/** Dosya adının izinli uzantısı (küçük harf) ya da null. */
export function ledgerFileExt(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  return Object.hasOwn(LEDGER_FILE_TYPES, ext) ? ext : null;
}

export type LedgerEntryValues = z.infer<ReturnType<typeof ledgerEntrySchema>>;
