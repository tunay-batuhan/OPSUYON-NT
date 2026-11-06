"use client";

import { createOrganization, createProject, updateOrganization, updateProject } from "@/app/actions/projects";
import { useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Loader2, Trash2 } from "lucide-react";
import { assignPersonnel, createPersonnel, deletePersonnel, updatePersonnel } from "@/app/actions/personnel";
import {
  assignSchema, organizationSchema, organizationUpdateSchema, projectCreateSchema, projectUpdateSchema,
} from "@/lib/schemas";
import { MARITAL_OPTIONS, personnelCreateSchema, personnelEditSchema } from "@/lib/schemas-personnel";
import { ageOf, legalAnnualLeaveDays, tenureLabel } from "@/lib/leave-law";
import type { Personnel } from "@/lib/types";
import { Form, FormGrid, SelectField, SubmitButton, TextField, TextareaField } from "@/components/forms/form";

type Option = { value: string; label: string };

export function OrganizationForm() {
  return (
    <Form
      schema={organizationSchema}
      defaultValues={{ name: "", legal_name: "", tax_office: "", tax_no: "", email: "", phone: "", address: "" }}
      action={createOrganization}
      className="space-y-4 p-5"
    >
      <FormGrid>
        <TextField name="name" label="Firma adı" required placeholder="Örn. Atlas Plaza" />
        <TextField name="legal_name" label="Ticari unvan" placeholder="Örn. Atlas Plaza Yönetimi A.Ş." />
        <TextField name="tax_office" label="Vergi dairesi" required />
        <TextField name="tax_no" label="Vergi no / TC" required inputMode="numeric" maxLength={11} hint="10 haneli vergi no veya 11 haneli TC kimlik no" />
        <TextField name="email" type="email" label="E-posta" autoComplete="off" placeholder="ornek@firma.com" />
        <TextField name="phone" type="tel" label="Telefon" required placeholder="0532 000 00 00" />
        <TextField name="address" label="Adres" required className="sm:col-span-2" />
      </FormGrid>
      <SubmitButton>Firmayı kaydet</SubmitButton>
    </Form>
  );
}

export function OrganizationEditForm({
  org,
}: { org: { id: string; name: string; legal_name: string | null; tax_office: string | null; tax_no: string | null; address: string | null; phone: string | null; email: string | null } }) {
  return (
    <Form
      schema={organizationUpdateSchema}
      defaultValues={{
        id: org.id, name: org.name, legal_name: org.legal_name ?? "", tax_office: org.tax_office ?? "", tax_no: org.tax_no ?? "",
        email: org.email ?? "", phone: org.phone ?? "", address: org.address ?? "",
      }}
      action={updateOrganization}
      resetOnSuccess={false}
      className="space-y-4 p-5"
    >
      <FormGrid>
        <TextField name="name" label="Firma adı" required />
        <TextField name="legal_name" label="Ticari unvan" />
        <TextField name="tax_office" label="Vergi dairesi" required />
        <TextField name="tax_no" label="Vergi no / TC" required inputMode="numeric" maxLength={11} />
        <TextField name="email" type="email" label="E-posta" autoComplete="off" />
        <TextField name="phone" type="tel" label="Telefon" required />
        <TextField name="address" label="Adres" required className="sm:col-span-2" />
      </FormGrid>
      <SubmitButton>Değişiklikleri kaydet</SubmitButton>
    </Form>
  );
}

/** Bitiş tarihi geçmişse: proje otomatik "Pasif" olur ve müşteri erişimi kapanır. */
function PastEndDateWarning() {
  const { control } = useFormContext();
  const end = useWatch({ control, name: "end_date" }) as string | undefined;
  if (!end || end >= new Date().toLocaleDateString("sv-SE")) return null;
  return (
    <p role="status" className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning sm:col-span-full">
      Bitiş tarihi geçmişte. Bu proje kaydedilince (ve her gece) otomatik <strong>Pasif</strong> olur; müşteri hesapları projeyi göremez. Yeni bir dönem için bitiş tarihini ileri bir tarih yapın.
    </p>
  );
}

export function ProjectCreateForm({ orgs, lines, defaultOrg }: { orgs: Option[]; lines: Option[]; defaultOrg?: string }) {
  return (
    <Form
      schema={projectCreateSchema}
      defaultValues={{ organization_id: defaultOrg ?? "", service_line: "", name: "", code: "", address: "", start_date: "", end_date: "" }}
      action={createProject}
      className="space-y-4 p-5"
    >
      <FormGrid>
        <SelectField name="organization_id" label="Firma" options={orgs} required />
        <SelectField name="service_line" label="Hizmet alanı" options={lines} required />
        <TextField name="name" label="Proje adı" required titleCase placeholder="Örn. Atlas Plaza Güvenlik" />
        <TextField name="code" label="Proje kodu" hint="İsteğe bağlı; benzersiz olmalı" />
        <TextField name="address" label="Adres" titleCase className="sm:col-span-2" />
        <TextField name="start_date" type="date" label="Başlangıç" />
        <TextField name="end_date" type="date" label="Bitiş" />
        <PastEndDateWarning />
      </FormGrid>
      <p className="text-xs text-muted">Firmanın mevcut “Firma Yöneticisi” hesaplarına bu projeye erişim otomatik verilir; diğer hesaplara Kullanıcılar sayfasından erişim verin.</p>
      <SubmitButton>Projeyi oluştur</SubmitButton>
    </Form>
  );
}

export function ProjectEditForm({
  project,
}: {
  project: { id: string; name: string; code: string | null; status: "active" | "paused" | "closed"; address: string | null; start_date: string | null; end_date: string | null; notes: string | null };
}) {
  return (
    <Form
      schema={projectUpdateSchema}
      defaultValues={{
        id: project.id,
        name: project.name,
        code: project.code ?? "",
        status: project.status,
        address: project.address ?? "",
        start_date: project.start_date ?? "",
        end_date: project.end_date ?? "",
        notes: project.notes ?? "",
      }}
      action={updateProject}
      resetOnSuccess={false}
      className="space-y-4 p-5"
    >
      <FormGrid>
        <TextField name="name" label="Proje adı" required titleCase />
        <TextField name="code" label="Proje kodu" />
        <SelectField
          name="status"
          label="Durum"
          placeholder=""
          options={[
            { value: "active", label: "Aktif" },
            { value: "paused", label: "Duraklatıldı" },
            { value: "closed", label: "Pasif (proje bitti; müşteri erişimi kapanır)" },
          ]}
        />
        <TextField name="address" label="Adres" titleCase />
        <TextField name="start_date" type="date" label="Başlangıç" />
        <TextField name="end_date" type="date" label="Bitiş" />
        <TextareaField name="notes" label="Notlar" className="sm:col-span-2" />
        <PastEndDateWarning />
      </FormGrid>
      <SubmitButton>Kaydet</SubmitButton>
    </Form>
  );
}

const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** İşe giriş ve doğum tarihinden canlı özet: yaş, çalışma süresi, yasal yıllık izin hakkı (İş K. md. 53). */
function PersonnelSummary() {
  const { control } = useFormContext();
  const [hire, birth] = useWatch({ control, name: ["hire_date", "birth_date"] }) as unknown[];
  const h = isIsoDate(hire) ? hire : null;
  const b = isIsoDate(birth) ? birth : null;
  const age = ageOf(b);
  const leave = legalAnnualLeaveDays(h, b);
  // bugünün tarihine bağlı değerler: sunucu/tarayıcı gün farkında uyarı vermesin
  return (
    <div role="status" aria-live="polite" className="grid gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm sm:grid-cols-3">
      <div>
        <p className="text-xs text-muted">Yaş</p>
        <p className="mt-0.5 font-semibold" suppressHydrationWarning>{age === null ? "—" : age}</p>
      </div>
      <div>
        <p className="text-xs text-muted">Çalışma süresi</p>
        <p className="mt-0.5 font-semibold" suppressHydrationWarning>{tenureLabel(h) ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs text-muted">Yasal yıllık izin hakkı</p>
        <p className="mt-0.5 font-semibold" suppressHydrationWarning>{h ? `${leave.days} gün` : "—"}</p>
        <p className="mt-0.5 text-xs text-muted" suppressHydrationWarning>{leave.reason}</p>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="mt-3 space-y-4">{children}</div>
    </fieldset>
  );
}

/** Personel kartı alanları (ekle ve düzenle formlarında ortak). Sicil no arayüzden kalktı. */
function PersonnelFields({ lines, orgs, canSensitive, edit }: { lines: Option[]; orgs: Option[]; canSensitive: boolean; edit?: boolean }) {
  return (
    <>
      <FormSection title="İş bilgileri">
        <FormGrid cols={3}>
          <TextField name="first_name" label="Ad" required />
          <TextField name="last_name" label="Soyad" required />
          <TextField name="title" label="Ünvan" placeholder="Örn. Güvenlik görevlisi" />
          <SelectField name="service_line" label="Hizmet alanı" options={lines} />
          <SelectField
            name="organization_id" label="Çalıştığı firma" options={orgs}
            hint={edit ? "Projeye atanmış personelin firması değiştirilemez." : "Personelin kadrosunda olduğu müşteri. Boşsa ilk atandığı projenin firması yazılır."}
          />
          <TextField name="hire_date" type="date" label="İşe giriş" />
          {edit && (
            <SelectField
              name="status" label="Durum" placeholder=""
              options={[{ value: "active", label: "Aktif" }, { value: "passive", label: "Pasif" }, { value: "terminated", label: "Ayrıldı" }]}
            />
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Kişisel bilgiler">
        <FormGrid cols={3}>
          <TextField name="birth_date" type="date" label="Doğum tarihi" />
          <TextField name="birth_place" label="Doğum yeri" titleCase />
          <TextField name="hometown" label="Memleketi" titleCase />
          <SelectField name="marital_status" label="Medeni hali" options={MARITAL_OPTIONS} />
          <TextField name="phone" type="tel" label="Telefon" placeholder="0532 000 00 00" />
          <TextField name="email" type="email" label="E-posta" autoComplete="off" />
          <TextField name="emergency_phone" type="tel" label="Yedek telefon" placeholder="0532 000 00 00" />
          <TextField name="emergency_contact_name" label="Yedek telefon kime ait" placeholder="Örn. Eşi Ayşe Yılmaz" titleCase className="sm:col-span-2" />
          <TextareaField name="address" label="Adres" rows={2} className="sm:col-span-3" />
          {canSensitive && (
            <>
              <TextField name="national_id" label="TC kimlik no" inputMode="numeric" maxLength={11} hint="Algoritma ile doğrulanır; yalnızca yetkili merkez kullanıcıları görür" />
              <TextField name="iban" label="IBAN" placeholder="TR00 0000 0000 0000 0000 0000 00" className="sm:col-span-2" />
            </>
          )}
        </FormGrid>
        <PersonnelSummary />
      </FormSection>

      <FormSection title="Beden ölçüleri">
        <FormGrid cols={6}>
          <TextField name="height_cm" label="Boy" inputMode="numeric" suffix="cm" maxLength={3} />
          <TextField name="weight_kg" label="Kilo" inputMode="numeric" suffix="kg" maxLength={3} />
          <TextField name="pants_size" label="Pantolon ölçüsü" placeholder="Örn. 42" maxLength={10} />
          <TextField name="shirt_size" label="Gömlek ölçüsü" placeholder="Örn. L" maxLength={10} />
          <TextField name="coat_size" label="Mont ölçüsü" placeholder="Örn. XL" maxLength={10} />
          <TextField name="shoe_size" label="Ayakkabı no" inputMode="numeric" placeholder="Örn. 43" maxLength={10} />
        </FormGrid>
      </FormSection>
    </>
  );
}

const emptyCard = {
  first_name: "", last_name: "", title: "", service_line: "", organization_id: "", hire_date: "", phone: "", email: "", national_id: "", iban: "",
  birth_date: "", birth_place: "", hometown: "", address: "", marital_status: "", height_cm: "", weight_kg: "",
  pants_size: "", shirt_size: "", coat_size: "", shoe_size: "", emergency_phone: "", emergency_contact_name: "",
};

export function PersonnelForm({ lines, orgs, canSensitive }: { lines: Option[]; orgs: Option[]; canSensitive: boolean }) {
  return (
    <Form schema={personnelCreateSchema} defaultValues={emptyCard} action={createPersonnel} className="space-y-6 p-5">
      <PersonnelFields lines={lines} orgs={orgs} canSensitive={canSensitive} />
      <SubmitButton>Personeli kaydet</SubmitButton>
    </Form>
  );
}

export function AssignForm({ projectId, candidates }: { projectId: string; candidates: Option[] }) {
  return (
    <Form schema={assignSchema} defaultValues={{ project_id: projectId, personnel_id: "", position: "", start_date: "" }} action={assignPersonnel} className="space-y-4 p-5">
      <FormGrid cols={3}>
        <SelectField name="personnel_id" label="Personel" options={candidates} required searchable />
        <TextField name="position" label="Görev" placeholder="Örn. Güvenlik görevlisi" />
        <TextField name="start_date" type="date" label="Başlangıç" hint="Boşsa bugün" />
      </FormGrid>
      <SubmitButton>Ata</SubmitButton>
    </Form>
  );
}

type CardKey =
  | "id" | "first_name" | "last_name" | "title" | "service_line" | "organization_id" | "hire_date" | "phone" | "email" | "status"
  | "birth_date" | "birth_place" | "hometown" | "address" | "marital_status" | "height_cm" | "weight_kg"
  | "pants_size" | "shirt_size" | "coat_size" | "shoe_size" | "emergency_phone" | "emergency_contact_name";

export function PersonnelEditForm({
  person, lines, orgs, canSensitive,
}: {
  person: Pick<Personnel, CardKey> & { national_id: string | null; iban: string | null };
  lines: Option[];
  orgs: Option[];
  canSensitive: boolean;
}) {
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return (
    <Form
      schema={personnelEditSchema}
      defaultValues={{
        id: person.id, status: person.status,
        first_name: person.first_name, last_name: person.last_name, title: s(person.title), service_line: s(person.service_line),
        organization_id: s(person.organization_id), hire_date: s(person.hire_date), phone: s(person.phone), email: s(person.email),
        national_id: s(person.national_id), iban: s(person.iban),
        birth_date: s(person.birth_date), birth_place: s(person.birth_place), hometown: s(person.hometown), address: s(person.address),
        marital_status: s(person.marital_status), height_cm: s(person.height_cm), weight_kg: s(person.weight_kg),
        pants_size: s(person.pants_size), shirt_size: s(person.shirt_size), coat_size: s(person.coat_size), shoe_size: s(person.shoe_size),
        emergency_phone: s(person.emergency_phone), emergency_contact_name: s(person.emergency_contact_name),
      }}
      action={updatePersonnel}
      resetOnSuccess={false}
      className="space-y-6 p-5"
    >
      <PersonnelFields lines={lines} orgs={orgs} canSensitive={canSensitive} edit />
      <SubmitButton>Kartı kaydet</SubmitButton>
    </Form>
  );
}

export function DeletePersonnelButton({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`${name} personel kartı kalıcı olarak silinsin mi?`)) return;
          setBusy(true);
          setError(null);
          try {
            const res = await deletePersonnel({ id });
            if (res?.error) setError(res.error);
          } catch (e) {
            const digest = (e as { digest?: unknown })?.digest;
            if (!(typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"))) setError(e instanceof Error ? e.message : "Silinemedi.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-danger-soft px-4 text-sm font-medium text-danger hover:brightness-95 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Personel kartını sil
      </button>
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
