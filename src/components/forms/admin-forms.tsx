"use client";

import { createOrganization, createProject, updateProject } from "@/app/actions/projects";
import { assignPersonnel, createPersonnel } from "@/app/actions/personnel";
import {
  assignSchema, organizationSchema, personnelSchema, projectCreateSchema, projectUpdateSchema,
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
        <TextField name="tax_office" label="Vergi dairesi" />
        <TextField name="tax_no" label="Vergi no / TC" inputMode="numeric" maxLength={11} hint="10 haneli vergi no veya 11 haneli TC kimlik no" />
        <TextField name="email" type="email" label="E-posta" autoComplete="off" placeholder="ornek@firma.com" />
        <TextField name="phone" type="tel" label="Telefon" placeholder="0532 000 00 00" />
        <TextField name="address" label="Adres" className="sm:col-span-2" />
      </FormGrid>
      <SubmitButton>Firmayı kaydet</SubmitButton>
    </Form>
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
        <TextField name="name" label="Proje adı" required placeholder="Örn. Atlas Plaza Güvenlik" />
        <TextField name="code" label="Proje kodu" hint="İsteğe bağlı; benzersiz olmalı" />
        <TextField name="address" label="Adres" className="sm:col-span-2" />
        <TextField name="start_date" type="date" label="Başlangıç" />
        <TextField name="end_date" type="date" label="Bitiş" />
      </FormGrid>
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
        <TextField name="name" label="Proje adı" required />
        <TextField name="code" label="Proje kodu" />
        <SelectField
          name="status"
          label="Durum"
          placeholder=""
          options={[
            { value: "active", label: "Aktif" },
            { value: "paused", label: "Duraklatıldı" },
            { value: "closed", label: "Kapandı (müşteri erişimi kapanır)" },
          ]}
        />
        <TextField name="address" label="Adres" />
        <TextField name="start_date" type="date" label="Başlangıç" />
        <TextField name="end_date" type="date" label="Bitiş" />
        <TextareaField name="notes" label="Notlar" className="sm:col-span-2" />
      </FormGrid>
      <SubmitButton>Kaydet</SubmitButton>
    </Form>
  );
}

export function PersonnelForm({ lines, canSensitive }: { lines: Option[]; canSensitive: boolean }) {
  return (
    <Form
      schema={personnelSchema}
      defaultValues={{ first_name: "", last_name: "", employee_no: "", title: "", service_line: "", hire_date: "", phone: "", email: "", national_id: "", iban: "" }}
      action={createPersonnel}
      className="space-y-4 p-5"
    >
      <FormGrid cols={3}>
        <TextField name="first_name" label="Ad" required />
        <TextField name="last_name" label="Soyad" required />
        <TextField name="employee_no" label="Sicil no" />
        <TextField name="title" label="Ünvan" placeholder="Örn. Güvenlik görevlisi" />
        <SelectField name="service_line" label="Hizmet alanı" options={lines} />
        <TextField name="hire_date" type="date" label="İşe giriş" />
        <TextField name="phone" type="tel" label="Telefon" placeholder="0532 000 00 00" />
        <TextField name="email" type="email" label="E-posta" autoComplete="off" />
        <span className="hidden sm:block" />
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
    <Form schema={assignSchema} defaultValues={{ project_id: projectId, personnel_id: "", position: "", shift: "", start_date: "" }} action={assignPersonnel} className="space-y-4 p-5">
      <FormGrid cols={3}>
        <SelectField name="personnel_id" label="Personel" options={candidates} required className="sm:col-span-1" />
        <TextField name="position" label="Görev" placeholder="Örn. Güvenlik görevlisi" />
        <TextField name="shift" label="Vardiya" placeholder="Örn. 08:00–20:00" />
        <TextField name="start_date" type="date" label="Başlangıç" hint="Boşsa bugün" />
      </FormGrid>
      <SubmitButton>Ata</SubmitButton>
    </Form>
  );
}
