"use client";

import { createFirmLedgerEntry } from "@/app/actions/firm-ledger";
import { ledgerAmountLabel, ledgerEntrySchema, type LedgerEntryValues, type LedgerKind } from "@/lib/schemas-ledger";
import { Form, FormGrid, SelectField, SubmitButton, TextField } from "@/components/forms/form";
import { DateField } from "@/components/forms/date-fields";

/**
 * Cari Hesap → Fatura girişi / Tahsilat girişi: Firma, tarih, saat, açıklama ve tutar.
 * Tarih ve saat varsayılan olarak şu an (Türkiye saati); sunucudan gelir.
 */
export function LedgerEntryForm({
  kind, firms, today, now,
}: { kind: LedgerKind; firms: { value: string; label: string }[]; today: string; now: string }) {
  const prefix = kind === "fatura" ? "Fatura" : "Tahsilat";
  return (
    <Form<LedgerEntryValues>
      schema={ledgerEntrySchema(kind)}
      defaultValues={{ kind, organization_id: "", entry_date: today, entry_time: now, description: "", amount: "" }}
      action={createFirmLedgerEntry}
      className="p-5"
    >
      <FormGrid cols={6}>
        <SelectField name="organization_id" label="Firma" required searchable options={firms} className="sm:col-span-6" />
        <DateField name="entry_date" label={`${prefix} tarihi`} required className="sm:col-span-3" />
        <TextField name="entry_time" label={`${prefix} saati`} type="time" required className="sm:col-span-3" />
        <TextField name="description" label="Açıklama" maxLength={500} placeholder={kind === "fatura" ? "Örn. Ekim 2026 güvenlik hizmeti" : "Örn. Havale / EFT"} className="sm:col-span-6" />
        <TextField
          name="amount" label={ledgerAmountLabel(kind)} required inputMode="decimal" suffix="₺" placeholder="0,00"
          hint="Kuruş için virgül kullanın (ör. 12.500,75)" className="sm:col-span-3"
        />
      </FormGrid>
      <div className="mt-5 flex justify-end">
        <SubmitButton>{kind === "fatura" ? "Faturayı kaydet" : "Tahsilatı kaydet"}</SubmitButton>
      </div>
    </Form>
  );
}
