"use client";

import { createOrganization, createProject, updateOrganization, updateProject } from "@/app/actions/projects";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Loader2, Trash2 } from "lucide-react";
import { assignPersonnel, createPersonnel, deletePersonnel, updatePersonnel } from "@/app/actions/personnel";
import {
  assignSchema, personnelUpdateSchema, organizationSchema, organizationUpdateSchema, personnelSchema, projectCreateSchema, projectUpdateSchema,
} from "@/lib/schemas";
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

export function PersonnelForm({ lines, orgs, canSensitive }: { lines: Option[]; orgs: Option[]; canSensitive: boolean }) {
  return (
    <Form
      schema={personnelSchema}
      defaultValues={{ first_name: "", last_name: "", employee_no: "", title: "", service_line: "", organization_id: "", hire_date: "", phone: "", email: "", national_id: "", iban: "" }}
      action={createPersonnel}
      className="space-y-4 p-5"
    >
      <FormGrid cols={3}>
        <TextField name="first_name" label="Ad" required />
        <TextField name="last_name" label="Soyad" required />
        <TextField name="employee_no" label="Sicil no" />
        <TextField name="title" label="Ünvan" placeholder="Örn. Güvenlik görevlisi" />
        <SelectField name="service_line" label="Hizmet alanı" options={lines} />
        <SelectField name="organization_id" label="Çalıştığı firma" options={orgs} hint="Personelin kadrosunda olduğu müşteri. Boşsa ilk atandığı projenin firması yazılır." />
        <TextField name="hire_date" type="date" label="İşe giriş" />
        <TextField name="phone" type="tel" label="Telefon" placeholder="0532 000 00 00" />
        <TextField name="email" type="email" label="E-posta" autoComplete="off" />
        {canSensitive && (
          <>
            <TextField name="national_id" label="TC kimlik no" inputMode="numeric" maxLength={11} hint="Algoritma ile doğrulanır; yalnızca yetkili merkez kullanıcıları görür" />
            <TextField name="iban" label="IBAN" placeholder="TR00 0000 0000 0000 0000 0000 00" className="sm:col-span-2" />
          </>
        )}
      </FormGrid>
      <SubmitButton>Personeli kaydet</SubmitButton>
    </Form>
  );
}

export function AssignForm({ projectId, candidates }: { projectId: string; candidates: Option[] }) {
  return (
    <Form schema={assignSchema} defaultValues={{ project_id: projectId, personnel_id: "", position: "", start_date: "" }} action={assignPersonnel} className="space-y-4 p-5">
      <FormGrid cols={3}>
        <SelectField name="personnel_id" label="Personel" options={candidates} required />
        <TextField name="position" label="Görev" placeholder="Örn. Güvenlik görevlisi" />
        <TextField name="start_date" type="date" label="Başlangıç" hint="Boşsa bugün" />
      </FormGrid>
      <SubmitButton>Ata</SubmitButton>
    </Form>
  );
}

export function PersonnelEditForm({
  person, lines, orgs, canSensitive,
}: {
  person: {
    id: string; first_name: string; last_name: string; employee_no: string | null; title: string | null; service_line: string | null;
    organization_id: string | null; hire_date: string | null; phone: string | null; email: string | null; status: "active" | "passive" | "terminated";
    national_id: string | null; iban: string | null;
  };
  lines: Option[];
  orgs: Option[];
  canSensitive: boolean;
}) {
  return (
    <Form
      schema={personnelUpdateSchema}
      defaultValues={{
        id: person.id, first_name: person.first_name, last_name: person.last_name, employee_no: person.employee_no ?? "", title: person.title ?? "",
        service_line: person.service_line ?? "", organization_id: person.organization_id ?? "", hire_date: person.hire_date ?? "", phone: person.phone ?? "", email: person.email ?? "",
        national_id: person.national_id ?? "", iban: person.iban ?? "", status: person.status,
      }}
      action={updatePersonnel}
      resetOnSuccess={false}
      className="space-y-4 p-5"
    >
      <FormGrid cols={3}>
        <TextField name="first_name" label="Ad" required />
        <TextField name="last_name" label="Soyad" required />
        <TextField name="employee_no" label="Sicil no" />
        <TextField name="title" label="Ünvan" />
        <SelectField name="service_line" label="Hizmet alanı" options={lines} />
        <SelectField name="organization_id" label="Çalıştığı firma" options={orgs} hint="Projeye atanmış personelin firması değiştirilemez." />
        <TextField name="hire_date" type="date" label="İşe giriş" />
        <TextField name="phone" type="tel" label="Telefon" />
        <TextField name="email" type="email" label="E-posta" autoComplete="off" />
        <SelectField
          name="status" label="Durum" placeholder=""
          options={[{ value: "active", label: "Aktif" }, { value: "passive", label: "Pasif" }, { value: "terminated", label: "Ayrıldı" }]}
        />
        {canSensitive && (
          <>
            <TextField name="national_id" label="TC kimlik no" inputMode="numeric" maxLength={11} />
            <TextField name="iban" label="IBAN" className="sm:col-span-2" />
          </>
        )}
      </FormGrid>
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
