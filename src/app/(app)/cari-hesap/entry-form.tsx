"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { createFirmLedgerEntry, discardLedgerUpload } from "@/app/actions/firm-ledger";
import { ledgerAmountLabel, ledgerEntrySchema, ledgerFileLabel, type LedgerEntryValues, type LedgerKind } from "@/lib/schemas-ledger";
import { Form, FormGrid, SelectField, TextField } from "@/components/forms/form";
import { DateField } from "@/components/forms/date-fields";
import { btn } from "@/components/ui";
import { FileDrop, uploadLedgerFile } from "./ledger-file";

/** İsteğe bağlı dosya (fatura PDF'i / görseli ya da dekont): seçilince firmanın klasörüne yüklenir, kayıtla birlikte bağlanır. */
function FileArea({ kind, onBusy }: { kind: LedgerKind; onBusy: (b: boolean) => void }) {
  const { control, getValues, setValue, setError, clearErrors, formState } = useFormContext<LedgerEntryValues>();
  const fileName = useWatch({ control, name: "file_name" });
  const [busy, setBusy] = useState(false);
  const error = formState.errors.file_path?.message;

  const clear = () => {
    const old = getValues("file_path");
    setValue("file_path", "");
    setValue("file_name", "");
    if (old) void discardLedgerUpload(old);
  };

  async function onFile(file: File | undefined) {
    clear();
    if (!file) return;
    const org = getValues("organization_id");
    if (!org) return setError("file_path", { message: "Önce firmayı seçin" });
    clearErrors("file_path");
    setBusy(true);
    onBusy(true);
    try {
      const path = await uploadLedgerFile(org, file);
      setValue("file_path", path);
      setValue("file_name", file.name);
    } catch (e) {
      setError("file_path", { message: e instanceof Error ? e.message : "Dosya yüklenemedi" });
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <FileDrop
      id={`ledger-file-${kind}`}
      label={ledgerFileLabel(kind)}
      hint={kind === "fatura" ? "Fatura PDF'ini ya da fotoğrafını seçin (PDF, JPG, PNG — en fazla 50 MB)" : "Dekontu seçin (PDF, JPG, PNG — en fazla 50 MB)"}
      fileName={fileName}
      busy={busy}
      error={error}
      onFile={onFile}
      onClear={() => {
        clear();
        clearErrors("file_path");
      }}
    />
  );
}

function Fields({ kind, firms }: { kind: LedgerKind; firms: { value: string; label: string }[] }) {
  const { getValues, setValue, setError, formState } = useFormContext<LedgerEntryValues>();
  const [uploading, setUploading] = useState(false);
  const prefix = kind === "fatura" ? "Fatura" : "Tahsilat";

  // Dosya seçilen firmanın klasörüne yüklenir; firma değişirse dosya yeniden seçtirilir.
  function onFirm(id: string) {
    const path = getValues("file_path");
    if (path && !path.startsWith(`ledger/${id.toLowerCase()}/`)) {
      setValue("file_path", "");
      setValue("file_name", "");
      void discardLedgerUpload(path);
      if (id) setError("file_path", { message: "Firma değişti; dosyayı yeniden seçin" });
    }
  }

  return (
    <>
      <FormGrid cols={6}>
        <SelectField name="organization_id" label="Firma" required searchable options={firms} onValueChange={onFirm} className="sm:col-span-6" />
        <DateField name="entry_date" label={`${prefix} tarihi`} required className="sm:col-span-3" />
        <TextField name="entry_time" label={`${prefix} saati`} type="time" required className="sm:col-span-3" />
        <TextField name="description" label="Açıklama" maxLength={500} placeholder={kind === "fatura" ? "Örn. Ekim 2026 güvenlik hizmeti" : "Örn. Havale / EFT"} className="sm:col-span-6" />
        <TextField
          name="amount" label={ledgerAmountLabel(kind)} required inputMode="decimal" suffix="₺" placeholder="0,00"
          hint="Kuruş için virgül kullanın (ör. 12.500,75)" className="sm:col-span-3"
        />
        <FileArea kind={kind} onBusy={setUploading} />
      </FormGrid>
      <div className="mt-5 flex justify-end">
        <button type="submit" disabled={formState.isSubmitting || uploading} className={btn("primary", "md")}>
          {(formState.isSubmitting || uploading) && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {uploading ? "Dosya yükleniyor…" : kind === "fatura" ? "Faturayı kaydet" : "Tahsilatı kaydet"}
        </button>
      </div>
    </>
  );
}

/**
 * Cari Hesap → Fatura girişi / Tahsilat girişi: Firma, tarih, saat, açıklama, tutar ve isteğe bağlı dosya.
 * Tarih ve saat varsayılan olarak şu an (Türkiye saati); sunucudan gelir.
 */
export function LedgerEntryForm({
  kind, firms, today, now,
}: { kind: LedgerKind; firms: { value: string; label: string }[]; today: string; now: string }) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <Form<LedgerEntryValues>
      schema={ledgerEntrySchema(kind)}
      defaultValues={{ kind, organization_id: "", entry_date: today, entry_time: now, description: "", amount: "", file_path: "", file_name: "" }}
      action={createFirmLedgerEntry}
      onSuccess={() => setResetKey((k) => k + 1)}
      className="p-5"
    >
      <Fields key={resetKey} kind={kind} firms={firms} />
    </Form>
  );
}
