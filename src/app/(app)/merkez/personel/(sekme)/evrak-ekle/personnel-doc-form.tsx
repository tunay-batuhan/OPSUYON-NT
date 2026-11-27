"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CheckCircle2, CircleAlert, FileUp, Loader2 } from "lucide-react";
import { prepareUpload } from "@/app/actions/documents";
import { personnelDocStatus, registerPersonnelDocument } from "@/app/actions/personnel-docs";
import { personnelDocumentSchema } from "@/lib/schemas-personnel";
import { MONTHS } from "@/lib/format";
import { FILE_SECTIONS, requiredCodes } from "@/lib/personnel-file";
import { CheckboxField, Form, FormGrid, SelectField, SubmitButton, TextField } from "@/components/forms/form";

/** Aktif ataması olan personel; belge bu atamanın projesine bağlanır. */
export type DocPerson = { id: string; label: string; projectId: string };
export type DocCategory = { code: string; name: string; requires_period: boolean };

const MAX = 50 * 1024 * 1024;
/** Özlük dosyasında her personelde beklenen evrak türleri (Özlük Evrakları ekranıyla aynı liste). */
const REQUIRED = new Set(requiredCodes(FILE_SECTIONS));
const FILE_FIELDS = ["storage_path", "file_name", "mime_type", "size_bytes"] as const;

/** Dosyayı imzalı URL ile doğrudan Storage'a yükler; gizli form alanlarını doldurur. */
function FileArea() {
  const { control, getValues, setValue, setError, clearErrors, formState } = useFormContext();
  const fileName = useWatch({ control, name: "file_name" }) as string;
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const error = formState.errors.storage_path?.message as string | undefined;

  async function onFile(file: File | undefined) {
    for (const f of FILE_FIELDS) setValue(f, "");
    if (!file) return;
    const projectId = getValues("project_id") as string;
    const category = getValues("category_code") as string;
    if (!projectId || !category) {
      setKey((k) => k + 1);
      return setError("storage_path", { message: "Önce personeli ve kategoriyi seçin" });
    }
    if (file.size > MAX) return setError("storage_path", { message: "Dosya 50 MB'tan büyük olamaz" });
    clearErrors("storage_path");
    setBusy(true);
    try {
      const prep = await prepareUpload({ projectId, category, fileName: file.name });
      if ("error" in prep) throw new Error(prep.error);
      // supabase-js `uploadToSignedUrl` ile aynı istek (istemci paketlenmeden)
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
      <label htmlFor="pdoc-file" className="mb-1.5 block text-sm font-medium">
        Dosya<span aria-hidden className="ml-0.5 text-danger">*</span>
      </label>
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm transition-colors hover:bg-surface-2 ${error ? "border-danger bg-danger-soft/40" : "border-border"}`}
      >
        {busy ? <Loader2 className="size-5 animate-spin text-muted" aria-hidden /> : fileName ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <FileUp className="size-5 text-muted" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">
          {busy ? "Yükleniyor…" : fileName ? `${fileName} yüklendi` : "Dosya seçmek için tıklayın (PDF, Excel, Word, görsel — en fazla 50 MB)"}
        </span>
        <input id="pdoc-file" key={key} type="file" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

/**
 * Seçilen personelin evrak durumu: yüklenmiş türler yeşil, eksikler kırmızı. Eksik türe tıklanınca kategori seçilir.
 * (Eğitim, savunma gibi her zaman eklenebilen türler listede yok; yalnızca özlük dosyasında beklenenler.)
 */
function DocStatus({ categories }: { categories: DocCategory[] }) {
  const { control, setValue } = useFormContext();
  const personId = useWatch({ control, name: "personnel_id" }) as string;
  const [state, setState] = useState<{ id: string; codes: Set<string> } | null>(null);

  useEffect(() => {
    if (!personId) return;
    let live = true;
    personnelDocStatus(personId)
      .then((codes) => live && setState({ id: personId, codes: new Set(codes) }))
      .catch(() => live && setState(null));
    return () => {
      live = false;
    };
  }, [personId]);

  if (!personId) return null;
  const expected = categories.filter((c) => REQUIRED.has(c.code));
  if (expected.length === 0) return null;
  const ready = state?.id === personId;
  const done = ready ? expected.filter((c) => state.codes.has(c.code)).length : 0;
  return (
    <div className="sm:col-span-6 rounded-xl border border-border p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        Evrak durumu
        {ready ? <span className="font-normal text-muted">{done} / {expected.length} yüklü · eksik olana tıklayınca kategori seçilir</span> : <Loader2 className="size-4 animate-spin text-muted" aria-hidden />}
      </p>
      {ready && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {expected.map((c) => {
            const ok = state.codes.has(c.code);
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => setValue("category_code", c.code, { shouldValidate: true, shouldDirty: true })}
                  className={`flex w-full items-center gap-2 rounded-lg border-l-4 px-3 py-2 text-left text-sm ${ok ? "border-success bg-success-soft/70" : "border-danger bg-danger-soft/70 font-medium text-danger"}`}
                >
                  {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 text-xs">{ok ? "Yüklendi" : "Yüklenmemiş"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Fields({ people, categories }: { people: DocPerson[]; categories: DocCategory[] }) {
  const { control, getValues, setValue, setError } = useFormContext();
  const category = useWatch({ control, name: "category_code" }) as string;
  const [fileKey, setFileKey] = useState(0);
  const cat = categories.find((c) => c.code === category);

  // Personel seçilince belge onun aktif atamasının projesine bağlanır. Dosya başka projenin
  // klasörüne yüklenmişse kayıt reddedileceği için dosya yeniden seçtirilir.
  function onPerson(id: string) {
    const projectId = people.find((p) => p.id === id)?.projectId ?? "";
    setValue("project_id", projectId);
    const path = getValues("storage_path") as string;
    if (path && !path.startsWith(`${projectId}/`)) {
      for (const f of FILE_FIELDS) setValue(f, "");
      setFileKey((k) => k + 1);
      if (projectId) setError("storage_path", { message: "Personel değişti; dosyayı yeniden seçin" });
    }
  }

  return (
    <FormGrid cols={6}>
      <SelectField
        name="personnel_id" label="Personel" required searchable className="sm:col-span-3"
        options={people.map((p) => ({ value: p.id, label: p.label }))}
        onValueChange={onPerson}
      />
      <SelectField
        name="category_code" label="Kategori" required className="sm:col-span-3"
        options={categories.map((c) => ({ value: c.code, label: c.name }))}
      />
      <DocStatus categories={categories} />
      <TextField name="title" label="Başlık" required placeholder="Örn. Sağlık Raporu 2026" titleCase className="sm:col-span-6" />
      {cat?.requires_period && (
        <>
          <SelectField name="period_month" label="Ay" placeholder="" className="sm:col-span-2" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          <TextField name="period_year" label="Yıl" inputMode="numeric" className="sm:col-span-1" />
        </>
      )}
      <FileArea key={fileKey} />
      <CheckboxField name="customer_visible" label="Müşteri bu belgeyi görebilsin" hint="Müşteri, personelin çalıştığı projede bu evrak türünü görme yetkisi varsa görür." className="sm:col-span-6" />
    </FormGrid>
  );
}

export function PersonnelDocForm({
  people, categories, defaultPerson, defaultCategory,
}: { people: DocPerson[]; categories: DocCategory[]; defaultPerson?: string; defaultCategory?: string }) {
  const [resetKey, setResetKey] = useState(0);
  const now = new Date();
  const pre = people.find((p) => p.id === defaultPerson);
  return (
    <Form
      schema={personnelDocumentSchema}
      defaultValues={{
        personnel_id: pre?.id ?? "", project_id: pre?.projectId ?? "", category_code: defaultCategory ?? "", title: "",
        period_month: String(now.getMonth() + 1), period_year: String(now.getFullYear()), description: "", customer_visible: true,
        storage_path: "", file_name: "", mime_type: "", size_bytes: "", inspection_date: "", inspection_shift: "",
      }}
      action={registerPersonnelDocument}
      onSuccess={() => setResetKey((k) => k + 1)}
      className="space-y-4 p-5"
    >
      <Fields key={resetKey} people={people} categories={categories} />
      <SubmitButton>
        <FileUp className="size-4" aria-hidden /> Evrakı kaydet
      </SubmitButton>
    </Form>
  );
}
