"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CalendarCheck, Download, FileUp, Loader2, Pencil } from "lucide-react";
import { attachLeaveDocument, createLeaveRecord } from "@/app/actions/leaves";
import { prepareUpload } from "@/app/actions/documents";
import { EMPTY_FILE, leaveRecordDocSchema } from "@/lib/schemas-ops";
import { LEAVE_TYPE_INFO } from "@/lib/leave-law";
import { Form, FormGrid, SelectField, SubmitButton, TextField } from "@/components/forms/form";
import { FileArea, OwnerSelect } from "@/components/forms/ops-upload-forms";
import { DateField, DateRangeFormField } from "@/components/forms/date-fields";
import { ViewButton } from "@/components/doc-viewer";

type Option = { value: string; label: string };

/** Personelin bu yılki yıllık izin durumu: bakiye satırı varsa sayılar, yoksa yasal hak tahmini. */
export type LeaveBalanceInfo =
  | { year: number; total: number; used: number; left: number }
  | { year: number; legal: { days: number; reason: string }; hasHireDate: boolean };

const fmtDays = (n: number) => `${Number.isInteger(n) ? n : n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} gün`;

/** Personel seçilince kalan yıllık izin; yıllık izin girilirken "bu izinle kalan" da gösterilir. */
function BalanceBox({ balances }: { balances: Record<string, LeaveBalanceInfo> }) {
  const { control } = useFormContext();
  const [assignment, type, days] = useWatch({ control, name: ["assignment", "leave_type", "days"] }) as string[];
  const b = balances[(assignment ?? "").split("|")[0] ?? ""];
  if (!b) return null;
  const deducts = LEAVE_TYPE_INFO.find((t) => t.code === type)?.deducts ?? false;
  const n = Number(String(days ?? "").replace(",", "."));
  const req = deducts && Number.isFinite(n) && n > 0 ? n : 0;

  if (!("left" in b)) {
    return (
      <div role="status" className="rounded-lg border border-border bg-surface-2/60 px-4 py-3 text-sm sm:col-span-6">
        <p className="font-medium">{b.year} yıllık izin bakiyesi henüz açılmamış</p>
        <p className="mt-0.5 text-muted">
          {b.hasHireDate
            ? `Yasal hak: ${fmtDays(b.legal.days)} (${b.legal.reason}). Yıllık izin kaydedilince bakiye bu hakla açılır${req ? `; bu izinle kalan ${fmtDays(b.legal.days - req)}` : ""}.`
            : "Personel kartında işe giriş tarihi yok; kalan izin hesaplanamaz. Önce personel kartına işe giriş tarihini girin."}
        </p>
      </div>
    );
  }
  const after = b.left - req;
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm sm:col-span-6 ${after < 0 ? "border-danger/40 bg-danger-soft/50" : "border-brand/30 bg-brand-soft/40"}`}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p>
          <span className="text-muted">Kalan yıllık izin ({b.year}): </span>
          <span className="text-base font-semibold">{fmtDays(b.left)}</span>
        </p>
        <p className="text-muted">Hak edilen {fmtDays(b.total)} · Kullanılan {fmtDays(b.used)}</p>
        {req > 0 && (
          <p className={after < 0 ? "font-semibold text-danger" : "font-medium"}>
            Bu izinle kalan: {fmtDays(after)}{after < 0 && " — kalan izinden fazla"}
          </p>
        )}
      </div>
      {!deducts && type && <p className="mt-1 text-xs text-muted">Seçilen izin türü yıllık izinden düşmez.</p>}
    </div>
  );
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const span = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;

/**
 * Öneriler (elle girilen alan hiç ezilmez):
 *  - Gün: elle girilmediyse, son tarih elle girildiyse tarihlerden; değilse türün yasal süresinden; o da yoksa tarihlerden.
 *  - Son tarih: elle girilmediyse başlangıç + gün − 1.
 *  - İşe dönüş (izin bitince): elle girilmediyse son tarihten bir gün sonra.
 * Formda yalnızca Gün ve Başlangıç sorulur; son tarih ve işe dönüş bunlardan hesaplanıp özet olarak gösterilir.
 */
function Suggest() {
  const { control, setValue, getFieldState, formState } = useFormContext();
  const [type, start, end, days, ret] = useWatch({ control, name: ["leave_type", "start_date", "end_date", "days", "return_date"] }) as string[];

  useEffect(() => {
    const dirty = (n: string) => getFieldState(n, formState).isDirty;
    const legal = LEAVE_TYPE_INFO.find((t) => t.code === type)?.legalDays;
    const s = ISO.test(start ?? "") ? start : "";
    const fromDates = s && ISO.test(end ?? "") && end >= s ? span(s, end) : null;

    let n = Number(String(days ?? "").replace(",", "."));
    if (!dirty("days")) {
      const next = dirty("end_date") && fromDates ? fromDates : (legal ?? fromDates);
      if (next && String(next) !== days) {
        setValue("days", String(next));
        n = next;
      }
    }
    let e = end;
    if (!dirty("end_date") && s && Number.isFinite(n) && n > 0) {
      e = addDays(s, Math.ceil(n) - 1);
      if (e !== end) setValue("end_date", e);
    }
    if (!dirty("return_date") && ISO.test(e ?? "") && (!s || e >= s)) {
      const r = addDays(e, 1);
      if (r !== ret) setValue("return_date", r);
    }
  }, [type, start, end, days, ret, setValue, getFieldState, formState]);
  return null;
}

const trDate = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

/**
 * Normalde başlangıç (takvim) + gün girilir; son gün ve işe dönüş hesaplanıp özet olarak görünür. "Tarihleri elle
 * değiştir" denince başlangıç–son gün tek aralık seçiciden (gün sayısı ondan hesaplanır), işe dönüş ayrı tarihten
 * seçilir. Tarihlerde hata varsa elle giriş kendiliğinden açılır.
 */
function LeaveDates() {
  const { control, formState, setValue, resetField } = useFormContext();
  const [start, end, ret] = useWatch({ control, name: ["start_date", "end_date", "return_date"] }) as string[];
  const [manual, setManual] = useState(false);
  const open = manual || Boolean(formState.errors.end_date || formState.errors.return_date);

  if (open) {
    return (
      <>
        <DateRangeFormField
          name="start_date"
          nameTo="end_date"
          label="İzin tarihleri"
          required
          className="sm:col-span-2"
          hint="Başlangıç ve son gün; gün sayısı buradan hesaplanır"
          onRange={(f, t) => setValue("days", String(span(f, t)), { shouldDirty: true, shouldValidate: true })}
        />
        <div className="sm:col-span-2">
          <DateField name="return_date" label="İşe dönüş tarihi" required align="right" hint="Son günden sonraki gün gelir; değiştirebilirsiniz" />
          <button
            type="button"
            onClick={() => {
              resetField("end_date", { defaultValue: "" });
              resetField("return_date", { defaultValue: "" });
              setManual(false);
            }}
            className="mt-1 text-xs font-medium text-brand hover:underline"
          >
            Otomatik hesaplamaya dön
          </button>
        </div>
      </>
    );
  }
  const ready = ISO.test(start ?? "") && ISO.test(end ?? "") && ISO.test(ret ?? "");
  return (
    <>
      <DateField name="start_date" label="İzin başlangıç" required className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium">İzin bitişi ve işe dönüş</span>
        <div className="flex min-h-10 items-start gap-2 rounded-lg border border-dashed border-border bg-surface-2/50 px-3 py-2 text-sm">
          {ready ? (
            <>
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <p className="leading-relaxed">
                <span className="text-muted">Son gün:</span> <span className="font-medium">{trDate(end)}</span>
                <br />
                <span className="text-muted">İşe dönüş:</span> <span className="font-medium">{trDate(ret)}</span>
              </p>
            </>
          ) : (
            <p className="py-0.5 text-muted">Gün ve başlangıç girilince otomatik hesaplanır</p>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Otomatik hesaplanır.{" "}
          <button type="button" onClick={() => setManual(true)} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <Pencil className="size-3" aria-hidden /> Tarihleri elle değiştir
          </button>
        </p>
      </div>
    </>
  );
}

/** İzin türü; altında seçilen türün yasal notu (ör. "Yasal hak: 3 gün ücretli; yıllık izinden düşmez"). */
function LeaveTypeField({ className }: { className?: string }) {
  const { control } = useFormContext();
  const type = useWatch({ control, name: "leave_type" }) as string;
  const info = LEAVE_TYPE_INFO.find((t) => t.code === type);
  const hint = info && (info.deducts || /düşmez/i.test(info.note) ? info.note : `${info.note}; yıllık izinden düşmez`);
  return (
    <SelectField
      name="leave_type" label="İzin türü" placeholder="" required className={className} hint={hint}
      options={LEAVE_TYPE_INFO.map((t) => ({ value: t.code, label: t.label }))}
    />
  );
}

/** İzin evrakı ekle: izin kaydı ve (isteğe bağlı) imzalı evrak tek seferde kaydedilir. */
export function LeaveRecordForm({ people, balances = {} }: { people: Option[]; balances?: Record<string, LeaveBalanceInfo> }) {
  const [fileKey, setFileKey] = useState(0);
  const reset = () => setFileKey((k) => k + 1);
  return (
    <Form
      schema={leaveRecordDocSchema}
      defaultValues={{ assignment: "", leave_type: "yillik", days: "", start_date: "", end_date: "", return_date: "", note: "", ...EMPTY_FILE }}
      action={createLeaveRecord}
      onSuccess={reset}
      className="space-y-4 p-5"
    >
      <Suggest />
      <FormGrid cols={6}>
        <OwnerSelect name="assignment" label="Personel adı" options={people} onReset={reset} className="sm:col-span-3" />
        <LeaveTypeField className="sm:col-span-3" />
        <BalanceBox balances={balances} />
        <TextField name="days" label="Gün (izin süresi)" required inputMode="decimal" suffix="gün" className="sm:col-span-2" hint="İzin türünün yasal süresi önerilir" />
        <LeaveDates />
        <TextField name="note" label="Not (isteğe bağlı)" className="sm:col-span-6" />
        <FileArea
          key={fileKey}
          category="yillik_izin"
          projectField="assignment"
          label="İmzalı izin evrakı"
          required={false}
          accept=".pdf,image/*"
          hint="İsteğe bağlı: imzalı izin evrakını seçin (PDF veya fotoğraf — en fazla 50 MB)"
        />
      </FormGrid>
      <SubmitButton>Kaydet</SubmitButton>
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
