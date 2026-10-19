"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { prepareUpload, registerDocument } from "@/app/actions/documents";
import { documentSchema } from "@/lib/schemas";
import { MONTHS } from "@/lib/format";
import {
  CheckboxField, Form, FormGrid, SelectField, SubmitButton, TextField,
} from "@/components/forms/form";

type Category = { code: string; name: string; scope: "personnel" | "project"; requires_period: boolean };
type Person = { id: string; full_name: string };

const MAX = 50 * 1024 * 1024;

/** File picker that uploads straight to Supabase Storage with a signed URL and fills the hidden form fields. */
function FileArea({ projectId }: { projectId: string }) {
  const { control, setValue, setError, clearErrors, formState } = useFormContext();
  const category = useWatch({ control, name: "category_code" }) as string;
  const fileName = useWatch({ control, name: "file_name" }) as string;
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const error = formState.errors.storage_path?.message as string | undefined;

  async function onFile(file: File | undefined) {
    setValue("storage_path", "");
    setValue("file_name", "");
    if (!file) return;
    if (file.size > MAX) return setError("storage_path", { message: "Dosya 50 MB'tan büyük olamaz" });
    clearErrors("storage_path");
    setBusy(true);
    try {
      const prep = await prepareUpload({ projectId, category, fileName: file.name });
      if ("error" in prep) throw new Error(prep.error);
      // Mirrors supabase-js `uploadToSignedUrl` without bundling the client.
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
    <div className="sm:col-span-6">
      <label htmlFor="doc-file" className="mb-1.5 block text-sm font-medium">
        Dosya<span aria-hidden className="ml-0.5 text-danger">*</span>
      </label>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm transition-colors hover:bg-surface-2 ${error ? "border-danger bg-danger-soft/40" : "border-border"}`}
      >
        {busy ? <Loader2 className="size-5 animate-spin text-muted" aria-hidden /> : fileName ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <FileUp className="size-5 text-muted" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">
          {busy ? "Yükleniyor…" : fileName ? `${fileName} yüklendi` : "Dosya seçmek için tıklayın (PDF, Excel, Word, görsel — en fazla 50 MB)"}
        </span>
        <input id="doc-file" key={key} type="file" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function UploadForm({
  projectId, categories, people, defaultCategory,
}: { projectId: string; categories: Category[]; people: Person[]; defaultCategory?: string }) {
  const now = new Date();
  const first = defaultCategory ?? categories[0]?.code ?? "";
  return <UploadInner projectId={projectId} categories={categories} people={people} first={first} year={now.getFullYear()} month={now.getMonth() + 1} />;
}

function UploadInner({
  projectId, categories, people, first, year, month,
}: { projectId: string; categories: Category[]; people: Person[]; first: string; year: number; month: number }) {
  const [category, setCategory] = useState(first);
  const [fileReset, setFileReset] = useState(0);
  const cat = categories.find((c) => c.code === category);

  return (
    <Form
      schema={documentSchema}
      defaultValues={{
        project_id: projectId, category_code: first, title: "", personnel_id: "", period_month: String(month), period_year: String(year),
        description: "", customer_visible: false, storage_path: "", file_name: "", mime_type: "", size_bytes: "",
        inspection_date: "", inspection_shift: "",
      }}
      action={registerDocument}
      onSuccess={() => setFileReset((k) => k + 1)}
      className="space-y-4 p-5"
    >
      <FormGrid cols={6}>
        <SelectField
          name="category_code" label="Kategori" placeholder="" required className="sm:col-span-2"
          options={categories.map((c) => ({ value: c.code, label: c.name }))}
          onValueChange={setCategory}
        />
        <TextField name="title" label="Başlık" required placeholder="Örn. Eylül 2026 bordrosu" className="sm:col-span-4" />
        {cat?.scope === "personnel" && (
          <SelectField name="personnel_id" label="Personel" required className="sm:col-span-3" options={people.map((p) => ({ value: p.id, label: p.full_name }))} />
        )}
        {category === "denetim" && (
          <>
            <TextField name="inspection_date" label="Denetim tarihi" type="date" required className="sm:col-span-3" />
            <SelectField
              name="inspection_shift" label="Vardiya" required className="sm:col-span-3"
              options={[{ value: "gece", label: "Gece" }, { value: "gunduz", label: "Gündüz" }]}
            />
          </>
        )}
        {cat?.requires_period && category !== "denetim" && (
          <>
            <SelectField name="period_month" label="Ay" placeholder="" className="sm:col-span-2" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
            <TextField name="period_year" label="Yıl" inputMode="numeric" className="sm:col-span-1" />
          </>
        )}
        <FileArea key={fileReset} projectId={projectId} />
        <CheckboxField name="customer_visible" label="Müşteri bu belgeyi görebilsin (yetkisi varsa)" className="sm:col-span-6" />
      </FormGrid>
      <SubmitButton>
        <FileUp className="size-4" aria-hidden /> Belgeyi kaydet
      </SubmitButton>
    </Form>
  );
}
