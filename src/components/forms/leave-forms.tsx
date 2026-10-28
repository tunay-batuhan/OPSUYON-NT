"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Download, FileUp, Loader2 } from "lucide-react";
import { attachLeaveDocument, createLeaveRecord } from "@/app/actions/leaves";
import { prepareUpload } from "@/app/actions/documents";
import { leaveRecordSchema } from "@/lib/schemas";
import { LEAVE_TYPE_LABELS } from "@/lib/format";
import { Form, FormGrid, SelectField, SubmitButton, TextField } from "@/components/forms/form";
import { ViewButton } from "@/components/doc-viewer";

type Option = { value: string; label: string };

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Başlangıç/son tarihten toplam süreyi ve işe başlama tarihini önerir; ikisi de elle değiştirilebilir. */
function Suggest() {
  const { control, setValue, getFieldState, formState } = useFormContext();
  const start = useWatch({ control, name: "start_date" }) as string;
  const end = useWatch({ control, name: "end_date" }) as string;

  useEffect(() => {
    if (!start || !end || end < start) return;
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    if (!getFieldState("days", formState).isDirty) setValue("days", String(days));
    if (!getFieldState("return_date", formState).isDirty) setValue("return_date", addDays(end, 1));
  }, [start, end, setValue, getFieldState, formState]);
  return null;
}

export function LeaveRecordForm({ people }: { people: Option[] }) {
  return (
    <Form
      schema={leaveRecordSchema}
      defaultValues={{ assignment: "", leave_type: "yillik", start_date: "", end_date: "", return_date: "", days: "", note: "" }}
      action={createLeaveRecord}
      className="space-y-4 p-5"
    >
      <Suggest />
      <FormGrid cols={3}>
        <SelectField
          name="leave_type" label="Kategori" placeholder="" required
          options={Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField name="assignment" label="Personel adı" options={people} required className="sm:col-span-2" />
        <TextField name="start_date" type="date" label="İzin başlangıç tarihi" required />
        <TextField name="end_date" type="date" label="İzin son tarihi" required />
        <TextField name="return_date" type="date" label="İşe başlama tarihi" required hint="Sondan bir gün sonrası önerilir" />
        <TextField name="days" label="Toplam izin süresi" required inputMode="decimal" suffix="gün" hint="Tarihlerden önerilir; elle değiştirip kaydedebilirsiniz" />
        <TextField name="note" label="Not" className="sm:col-span-2" />
      </FormGrid>
      <SubmitButton>İzni kaydet</SubmitButton>
    </Form>
  );
}

/** Satır yanında: evrakı göster / yükle. */
export function LeaveDocCell({
  recordId, projectId, documentId, canManage,
}: { recordId: string; projectId: string | null; documentId: string | null; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(documentId);
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file || !projectId) return;
    if (file.size > 50 * 1024 * 1024) return setError("Dosya 50 MB'tan büyük olamaz.");
    setBusy(true);
    setError(null);
    try {
      const prep = await prepareUpload({ projectId, category: "yillik_izin", fileName: file.name });
      if ("error" in prep) throw new Error(prep.error);
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const res = await fetch(prep.signedUrl, { method: "PUT", body, headers: { apikey: prep.anonKey, "x-upsert": "false" } });
      if (!res.ok) throw new Error("Dosya yüklenemedi");
      const saved = await attachLeaveDocument({ recordId, path: prep.path, fileName: file.name, mimeType: file.type, size: file.size });
      if (saved?.error) throw new Error(saved.error);
      setDoc("yeni");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {doc && doc !== "yeni" && (
        <>
          <ViewButton src={`/api/documents/${doc}/view`} title="İzin evrakı" downloadHref={`/api/documents/${doc}`} label="Evrak görüntüle" />
          <a href={`/api/documents/${doc}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-surface-2">
            <Download className="size-4" aria-hidden /> İndir
          </a>
        </>
      )}
      {doc === "yeni" && <span className="text-sm text-success">Evrak yüklendi · sayfayı yenileyin</span>}
      {canManage && projectId && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-brand hover:bg-brand-soft">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {doc ? "Değiştir" : "Evrak yükle"}
          <input ref={input} type="file" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
      {!doc && !canManage && <span className="text-sm text-muted">—</span>}
      {error && <span role="alert" className="w-full text-xs text-danger">{error}</span>}
    </div>
  );
}
