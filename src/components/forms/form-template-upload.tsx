"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { prepareFormUpload, registerFormTemplate } from "@/app/actions/forms";
import { formTemplateSchema } from "@/lib/schemas";
import { Form, FormGrid, SubmitButton, TextField } from "@/components/forms/form";

const MAX = 20 * 1024 * 1024;

/** Dosya seçici: imzalı adresle doğrudan Storage'a yükler ve gizli form alanlarını doldurur. */
function FileArea() {
  const { setValue, setError, clearErrors, formState, control } = useFormContext();
  const fileName = useWatch({ control, name: "file_name" }) as string;
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const error = formState.errors.storage_path?.message as string | undefined;

  async function onFile(file: File | undefined) {
    setValue("storage_path", "");
    setValue("file_name", "");
    if (!file) return;
    if (file.size > MAX) return setError("storage_path", { message: "Dosya 20 MB'tan büyük olamaz" });
    clearErrors("storage_path");
    setBusy(true);
    try {
      const prep = await prepareFormUpload({ fileName: file.name });
      if ("error" in prep) throw new Error(prep.error);
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const res = await fetch(prep.signedUrl, { method: "PUT", body, headers: { apikey: prep.anonKey, "x-upsert": "false" } });
      if (!res.ok) throw new Error("Dosya yüklenemedi");
      setValue("storage_path", prep.path, { shouldValidate: true });
      setValue("file_name", file.name);
      setValue("mime_type", file.type);
      setValue("size_bytes", String(file.size));
    } catch (e) {
      setError("storage_path", { message: e instanceof Error ? e.message : "Dosya yüklenemedi" });
      setKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <span className="mb-1.5 block text-sm font-medium">
        Dosya<span aria-hidden className="ml-0.5 text-danger">*</span>
      </span>
      <label className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm transition-colors hover:bg-surface-2 ${error ? "border-danger bg-danger-soft/40" : "border-border"}`}>
        {busy ? <Loader2 className="size-5 animate-spin text-muted" aria-hidden /> : fileName ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <FileUp className="size-5 text-muted" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{busy ? "Yükleniyor…" : fileName ? `${fileName} yüklendi` : "Form dosyasını seçmek için tıklayın (PDF, Word, Excel — en fazla 20 MB)"}</span>
        <input key={key} type="file" className="sr-only" aria-label="Form dosyası" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Merkez: yeni form şablonu ekler. */
export function FormTemplateUpload() {
  const [reset, setReset] = useState(0);
  return (
    <Form
      schema={formTemplateSchema}
      defaultValues={{ title: "", description: "", storage_path: "", file_name: "", mime_type: "", size_bytes: "" }}
      action={registerFormTemplate}
      onSuccess={() => setReset((k) => k + 1)}
      className="space-y-4 p-5"
    >
      <FormGrid cols={2}>
        <TextField name="title" label="Form adı" required placeholder="Örn. Yıllık İzin Talep Formu" />
        <TextField name="description" label="Açıklama" placeholder="İsteğe bağlı kısa not" />
        <FileArea key={reset} />
      </FormGrid>
      <SubmitButton>Formu ekle</SubmitButton>
    </Form>
  );
}
