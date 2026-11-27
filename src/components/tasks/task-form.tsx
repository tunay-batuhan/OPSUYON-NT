"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormContext, useWatch } from "react-hook-form";
import { Building2, CheckCircle2, ClipboardList, CloudUpload, HardHat, ImageIcon, Info, MapPin, Send, UserRound, X } from "lucide-react";
import { saveTask } from "@/app/actions/tasks";
import { taskSchema, TASK_FILE_ACCEPT, type TaskValues } from "@/lib/schemas-tasks";
import { DateField } from "@/components/forms/date-fields";
import { Form, FormGrid, SelectField, SubmitButton, TextareaField, TextField } from "@/components/forms/form";
import { uploadTaskFile } from "@/components/tasks/upload";
import { cn } from "@/components/ui";

export type PersonOption = { value: string; label: string; project_id: string; job: string };
type Option = { value: string; label: string };

/** Görev kime? Saha personeli (projede görevli) ya da merkez kullanıcısı. Yalnızca yeni görevde ve ikisi de mümkünse görünür. */
function TargetSwitch() {
  const { control, setValue, clearErrors } = useFormContext<TaskValues>();
  const target = useWatch({ control, name: "target" });
  const options = [
    { value: "field" as const, label: "Saha personeli", hint: "Projede görevli personele", Icon: HardHat },
    { value: "staff" as const, label: "Merkez kullanıcısı", hint: "Merkezdeki bir kullanıcıya", Icon: Building2 },
  ];
  return (
    <div role="radiogroup" aria-label="Görev kime atanacak" className="grid gap-2 sm:grid-cols-2 lg:max-w-xl">
      {options.map((o) => {
        const active = target === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setValue("target", o.value, { shouldDirty: true });
              clearErrors(["project_id", "personnel_id", "assignee_id"]);
            }}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
              active ? "border-brand bg-brand-soft/60" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <o.Icon className={cn("size-5 shrink-0", active ? "text-brand" : "text-muted")} aria-hidden />
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Saha görevi: seçilen projenin aktif personeli; personel seçilince "Görevi" alanı (boşsa) pozisyonundan dolar.
 * Merkez görevi: merkez kullanıcısı seçilir (proje ve "Görevi" yoktur).
 */
function PersonFields({ projects, people, staff }: { projects: Option[]; people: PersonOption[]; staff: Option[] }) {
  const { control, setValue, getValues } = useFormContext<TaskValues>();
  const projectId = useWatch({ control, name: "project_id" });
  const target = useWatch({ control, name: "target" });
  const options = people.filter((p) => p.project_id === projectId);
  if (target === "staff") {
    return (
      <SelectField
        name="assignee_id"
        label="Merkez kullanıcısı"
        required
        searchable
        options={staff}
        placeholder="Kullanıcı adı yazın veya seçin…"
        hint={staff.length === 0 ? "Etkin merkez kullanıcısı yok." : undefined}
      />
    );
  }
  return (
    <>
      {projects.length > 1 && (
        <SelectField
          name="project_id"
          label="Proje"
          required
          options={projects}
          onValueChange={() => setValue("personnel_id", "")}
        />
      )}
      <SelectField
        name="personnel_id"
        label="Personel seçimi"
        required
        searchable
        options={options.map(({ value, label }) => ({ value, label }))}
        placeholder={projectId ? "Personel adı yazın veya seçin…" : "Önce projeyi seçin"}
        hint={projectId && options.length === 0 ? "Bu projede aktif personel yok." : undefined}
        onValueChange={(v) => {
          const p = options.find((o) => o.value === v);
          if (p && !getValues("job")) setValue("job", p.job, { shouldDirty: true });
        }}
      />
      <TextField name="job" label="Görevi" placeholder="Örn. Temizlik Personeli" maxLength={80} />
    </>
  );
}

/**
 * Yeni Görev Atama (ve düzenleme). Personel, görevi, başlık, açıklama, yer, isteğe bağlı tarih/saat ve fotoğraf/belge.
 * Dosyalar görev kaydedildikten sonra yüklenir (dosya yolu görev numarasını içerir).
 */
export function TaskForm({
  projects, people, staff = [], initial, submitLabel = "Görevi ata", onDoneHref,
}: {
  projects: Option[];
  people: PersonOption[];
  /** görev atanabilecek merkez kullanıcıları (yalnızca merkezde, tasks.assign yetkisi olana dolu gelir) */
  staff?: Option[];
  initial?: Partial<TaskValues>;
  submitLabel?: string;
  /** kaydedince gidilecek adres (düzenleme: görev sayfası). Verilmezse form temizlenir ve liste yenilenir. */
  onDoneHref?: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const editing = Boolean(initial?.id);

  const defaults: TaskValues = {
    id: initial?.id ?? "",
    target: initial?.target ?? (projects.length === 0 && staff.length > 0 ? "staff" : "field"),
    assignee_id: initial?.assignee_id ?? "",
    project_id: initial?.project_id ?? (projects.length === 1 ? projects[0].value : ""),
    personnel_id: initial?.personnel_id ?? "",
    title: initial?.title ?? "",
    job: initial?.job ?? "",
    description: initial?.description ?? "",
    location: initial?.location ?? "",
    planned_date: initial?.planned_date ?? "",
    planned_time: initial?.planned_time ?? "",
  };

  async function action(values: TaskValues) {
    setFileError(null);
    const res = await saveTask(values);
    if (!res?.ok || !res.id) return res;
    const failed: string[] = [];
    for (const f of files) {
      try {
        await uploadTaskFile(res.id, f);
      } catch (e) {
        failed.push(e instanceof Error ? e.message : f.name);
      }
    }
    setFiles([]);
    if (failed.length) setFileError(`Görev kaydedildi ama bazı dosyalar eklenemedi: ${failed.join(" · ")}`);
    if (onDoneHref) router.push(onDoneHref);
    else router.refresh();
    return res;
  }

  return (
    <Form schema={taskSchema} defaultValues={defaults} action={action} resetOnSuccess={!editing} className="space-y-5 p-5">
      {!editing && projects.length > 0 && staff.length > 0 && <TargetSwitch />}
      <FormGrid cols={3}>
        <PersonFields projects={projects} people={people} staff={staff} />
        <TextField name="title" label="Görev başlığı" required placeholder="Örn. A Blok giriş kat temizliği" maxLength={160} />
        <TextField name="location" label="Görev yeri" placeholder="Örn. A Blok giriş kat" maxLength={160} />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <DateField name="planned_date" label="Tarih" hint="İsteğe bağlı; kabulden sonra da verebilirsiniz" clearable />
          <TextField name="planned_time" type="time" label="Saat" />
        </div>
      </FormGrid>
      <TextareaField name="description" label="Görev açıklaması" rows={3} placeholder="Örn. A Blok giriş katı ve asansör çevresinin detaylı temizliği yapılacaktır." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="size-4 text-muted" aria-hidden /> Eklenecek fotoğraf / belge <span className="font-normal text-muted">(isteğe bağlı)</span>
          </p>
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border px-4 py-5 text-center text-sm transition-colors hover:border-brand hover:bg-brand-soft/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = Array.from(e.dataTransfer.files);
              setFiles((cur) => [...cur, ...dropped].slice(0, 10));
            }}
          >
            <CloudUpload className="size-7 text-brand" aria-hidden />
            <span className="font-semibold">Fotoğraf ekle</span>
            <span className="text-muted">(veya sürükleyin) · JPG, PNG, HEIC, PDF</span>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={TASK_FILE_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                // dosyalar kutu temizlenmeden ÖNCE kopyalanır (durum güncellemesi sonradan çalışır)
                const picked = Array.from(e.target.files ?? []);
                setFiles((cur) => [...cur, ...picked].slice(0, 10));
                if (fileInput.current) fileInput.current.value = "";
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="text-muted hover:text-danger" aria-label={`${f.name} dosyasını çıkar`}>
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fileError && <p role="alert" className="mt-2 text-sm text-danger">{fileError}</p>}
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-brand/20 bg-brand-soft/50 p-4 text-sm">
          <FormTips />
          <SubmitButton size="lg" className="self-end">
            <Send className="size-4" aria-hidden /> {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </Form>
  );
}

/** Formun sağındaki kısa bilgiler: saha ve merkez görevinde akış aynı, görevi gören ekran farklı. */
function FormTips() {
  const { control } = useFormContext<TaskValues>();
  const staffTask = useWatch({ control, name: "target" }) === "staff";
  const tips = staffTask
    ? [
        "Görev, seçtiğiniz merkez kullanıcısının zilinde ve İş Planlama'da “Bana atananlar” altında görünür.",
        "Kullanıcı görevi kabul eder ya da sorun varsa açıklama yazar.",
        "İş bitince “İşi bitirdim” der; son onayı (Tamamlandı) siz verirsiniz. Müşteri hesapları merkez görevlerini görmez.",
      ]
    : [
        "Göreve fotoğraf ekleyerek görev detayını destekleyebilirsiniz.",
        "Personel görevi telefonunda görür; kabul eder ya da sorun varsa açıklama yazar.",
        "İş bitince personel fotoğraf ekleyebilir; son onayı (Tamamlandı) siz verirsiniz.",
      ];
  return (
    <ul className="space-y-2">
      {tips.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t}
        </li>
      ))}
    </ul>
  );
}

/** "Yeni Görev Atama" kartının lacivert başlığı (müşterinin örnek ekranındaki gibi). */
export function NavyHeader({ title, icon = "list", className }: { title: string; icon?: "list" | "info" | "user" | "map"; className?: string }) {
  const Icon = icon === "info" ? Info : icon === "user" ? UserRound : icon === "map" ? MapPin : ClipboardList;
  return (
    <div className={cn("flex items-center gap-3 rounded-t-2xl bg-[var(--navy)] px-5 py-3.5 text-white", className)}>
      <Icon className="size-5" aria-hidden />
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}
