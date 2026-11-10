"use client";

import { useId, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { prepareUpload } from "@/app/actions/documents";
import { addInspectionDocument, addPayrollDocument, addRiskDocument, addTimesheetDocument } from "@/app/actions/ops-docs";
import { EMPTY_FILE, inspectionDocSchema, timesheetDocSchema } from "@/lib/schemas-ops";
import { MONTHS } from "@/lib/format";
import { CheckboxField, Form, FormGrid, SelectField, SubmitButton, TextField } from "@/components/forms/form";

type Option = { value: string; label: string };

const MAX = 50 * 1024 * 1024;
const FILE_FIELDS = Object.keys(EMPTY_FILE) as (keyof typeof EMPTY_FILE)[];
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Proje (veya "personelId|projeId") seçimi: değişince yüklenmiş dosya temizlenir,
 * çünkü dosya seçilen projenin klasörüne yüklenir.
 */
export function OwnerSelect({
  name, label, options, onReset, className, hint,
}: { name: string; label: string; options: Option[]; onReset: () => void; className?: string; hint?: string }) {
  const { getValues, setValue, clearErrors } = useFormContext();
  return (
    <SelectField
      name={name} label={label} options={options} required searchable className={className} hint={hint}
      onValueChange={() => {
        clearErrors("storage_path");
        if (!getValues("storage_path")) return;
        FILE_FIELDS.forEach((f) => setValue(f, ""));
        onReset();
      }}
    />
  );
}

/**
 * Dosya seçilince imzalı URL ile doğrudan Storage'a yükler ve gizli alanları (storage_path, file_name,
 * mime_type, size_bytes) doldurur. Proje `projectField` alanından okunur ("assignment" ise "personelId|projeId").
 */
export function FileArea({
  category, projectField = "project_id", label = "Dosya", required = true, accept, hint, className = "sm:col-span-6",
}: {
  category: string;
  projectField?: "project_id" | "assignment";
  label?: string;
  required?: boolean;
  accept?: string;
  hint?: string;
  className?: string;
}) {
  const { control, setValue, setError, clearErrors, formState } = useFormContext();
  const owner = (useWatch({ control, name: projectField }) as string | undefined) ?? "";
  const fileName = useWatch({ control, name: "file_name" }) as string;
  const projectId = projectField === "assignment" ? (owner.split("|")[1] ?? "") : owner;
  const ready = UUID.test(projectId);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const id = useId();
  const error = formState.errors.storage_path?.message as string | undefined;

  async function onFile(file: File | undefined) {
    FILE_FIELDS.forEach((f) => setValue(f, ""));
    if (!file) return;
    if (!ready) return setError("storage_path", { message: projectField === "assignment" ? "Önce personeli seçin" : "Önce projeyi seçin" });
    if (file.size > MAX) return setError("storage_path", { message: "Dosya 50 MB'tan büyük olamaz" });
    clearErrors("storage_path");
    setBusy(true);
    // dosya adı yükleme bitmeden yazılır: storage_path boşken kaydetme engellenir (şemadaki kural)
    setValue("file_name", file.name);
    try {
      const prep = await prepareUpload({ projectId, category, fileName: file.name });
      if ("error" in prep) throw new Error(prep.error);
      // supabase-js `uploadToSignedUrl` ile aynı istek, istemci paketi olmadan
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const res = await fetch(prep.signedUrl, { method: "PUT", body, headers: { apikey: prep.anonKey, "x-upsert": "false" } });
      if (!res.ok) throw new Error("Dosya yüklenemedi");
      setValue("mime_type", file.type);
      setValue("size_bytes", String(file.size));
      setValue("storage_path", prep.path, { shouldValidate: true });
    } catch (e) {
      setValue("file_name", "");
      setError("storage_path", { message: e instanceof Error ? e.message : "Dosya yüklenemedi" });
      setInputKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  const idle = ready
    ? hint ?? "Dosya seçmek için tıklayın (en fazla 50 MB)"
    : projectField === "assignment" ? "Önce personeli seçin" : "Önce projeyi seçin";

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </label>
      <label
        className={`flex items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm transition-colors ${ready ? "cursor-pointer hover:bg-surface-2" : "cursor-not-allowed opacity-60"} ${error ? "border-danger bg-danger-soft/40" : "border-border"}`}
      >
        {busy ? <Loader2 className="size-5 animate-spin text-muted" aria-hidden /> : fileName ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <FileUp className="size-5 text-muted" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{busy ? "Yükleniyor…" : fileName ? `${fileName} yüklendi` : idle}</span>
        {!busy && ready && <span className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium">Gözat</span>}
        <input id={id} key={inputKey} type="file" accept={accept} disabled={!ready || busy} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Otomatik üretilecek başlığın önizlemesi. */
function TitlePreview({ build }: { build: (v: Record<string, string>) => string | null }) {
  const { control } = useFormContext();
  const values = useWatch({ control }) as Record<string, string>;
  const title = build(values);
  return (
    <p className="text-sm text-muted sm:col-span-6">
      Başlık (otomatik): <span className="font-medium text-fg">{title ?? "alanlar doldurulunca oluşur"}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Puantaj / Bordro / Risk analizi ekle (proje + dönem + dosya)         */
/* ------------------------------------------------------------------ */
const PERIOD_DOCS = {
  puantaj: {
    label: "Puantaj",
    action: addTimesheetDocument,
    accept: ".pdf,.xls,.xlsx,.csv,image/*",
    hint: "Puantaj dosyasını seçin (PDF, Excel veya görsel — en fazla 50 MB)",
    visible: "İşaretliyse müşteri Puantaj ekranında bu dosyayı görür (yetkisi varsa).",
    submit: "Ekle",
  },
  bordro: {
    label: "Bordro",
    action: addPayrollDocument,
    accept: ".pdf,.xls,.xlsx,image/*",
    hint: "Bordro dosyasını seçin (PDF, Excel veya görsel — en fazla 50 MB)",
    visible: "İşaretliyse müşteri Bordrolar ekranında bu dosyayı görür (yetkisi varsa).",
    submit: "Bordroyu ekle",
  },
  risk_analizi: {
    label: "Risk Analizi",
    action: addRiskDocument,
    accept: ".pdf,image/*",
    hint: "Risk analizi raporunu seçin (PDF veya görsel — en fazla 50 MB)",
    visible: "İşaretliyse müşteri Risk Analizi ekranında bu raporu görür (yetkisi varsa).",
    submit: "Risk analizini ekle",
  },
} as const;

type PeriodFormProps = { projects: Option[]; years: Option[]; month: number; year: number };

function PeriodUploadForm({ kind, projects, years, month, year }: PeriodFormProps & { kind: keyof typeof PERIOD_DOCS }) {
  const cfg = PERIOD_DOCS[kind];
  const [fileKey, setFileKey] = useState(0);
  const reset = () => setFileKey((k) => k + 1);
  const nameOf = new Map(projects.map((p) => [p.value, p.label]));

  return (
    <Form
      schema={timesheetDocSchema}
      defaultValues={{ project_id: "", period_month: String(month), period_year: String(year), customer_visible: true, ...EMPTY_FILE }}
      action={cfg.action}
      onSuccess={reset}
      className="space-y-4 p-5"
    >
      <FormGrid cols={6}>
        <OwnerSelect name="project_id" label="Proje adı" options={projects} onReset={reset} className="sm:col-span-2" />
        <SelectField name="period_month" label="Ay" placeholder="" required className="sm:col-span-2" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <SelectField name="period_year" label="Yıl" placeholder="" required className="sm:col-span-2" options={years} />
        <FileArea key={fileKey} category={kind} accept={cfg.accept} hint={cfg.hint} />
        <CheckboxField name="customer_visible" label="Müşteri görebilsin" hint={cfg.visible} className="sm:col-span-6" />
        <TitlePreview
          build={(v) => {
            const name = nameOf.get(v.project_id);
            return name && v.period_month && v.period_year ? `${cfg.label} ${v.period_month.padStart(2, "0")}/${v.period_year} – ${name}` : null;
          }}
        />
      </FormGrid>
      <SubmitButton>
        <FileUp className="size-4" aria-hidden /> {cfg.submit}
      </SubmitButton>
    </Form>
  );
}

export function TimesheetUploadForm(props: PeriodFormProps) {
  return <PeriodUploadForm kind="puantaj" {...props} />;
}

export function PayrollUploadForm(props: PeriodFormProps) {
  return <PeriodUploadForm kind="bordro" {...props} />;
}

export function RiskUploadForm(props: PeriodFormProps) {
  return <PeriodUploadForm kind="risk_analizi" {...props} />;
}

/* ------------------------------------------------------------------ */
/* Yeni denetim ekle                                                    */
/* ------------------------------------------------------------------ */
const SHIFTS = [{ value: "gece", label: "Gece" }, { value: "gunduz", label: "Gündüz" }];

export function InspectionUploadForm({ projects }: { projects: Option[] }) {
  const [fileKey, setFileKey] = useState(0);
  const reset = () => setFileKey((k) => k + 1);
  const nameOf = new Map(projects.map((p) => [p.value, p.label]));

  return (
    <Form
      schema={inspectionDocSchema}
      defaultValues={{ project_id: "", inspection_date: "", inspection_shift: "", customer_visible: true, ...EMPTY_FILE }}
      action={addInspectionDocument}
      onSuccess={reset}
      className="space-y-4 p-5"
    >
      <FormGrid cols={6}>
        <OwnerSelect name="project_id" label="Proje adı" options={projects} onReset={reset} className="sm:col-span-2" />
        <TextField name="inspection_date" type="date" label="Denetim tarihi" required className="sm:col-span-2" />
        <SelectField name="inspection_shift" label="Vardiya" required className="sm:col-span-2" options={SHIFTS} />
        <FileArea key={fileKey} category="denetim" accept=".pdf,image/*" hint="Denetim raporunu seçin (PDF veya görsel — en fazla 50 MB)" />
        <CheckboxField name="customer_visible" label="Müşteri görebilsin" hint="İşaretliyse müşteri Denetimler ekranında bu raporu görür (yetkisi varsa)." className="sm:col-span-6" />
        <TitlePreview
          build={(v) => {
            const name = nameOf.get(v.project_id);
            const shift = SHIFTS.find((s) => s.value === v.inspection_shift)?.label;
            if (!name || !shift || !/^\d{4}-\d{2}-\d{2}$/.test(v.inspection_date ?? "")) return null;
            const [y, m, d] = v.inspection_date.split("-");
            return `Denetim Raporu ${d}.${m}.${y} ${shift} – ${name}`;
          }}
        />
      </FormGrid>
      <SubmitButton>
        <FileUp className="size-4" aria-hidden /> Denetimi ekle
      </SubmitButton>
    </Form>
  );
}
