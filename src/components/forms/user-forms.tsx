"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { addMembership, createCustomerUser, createStaffUser, resetPassword, updateStaffRole } from "@/app/actions/users";
import { customerUserSchema, membershipSchema, resetPasswordSchema, staffRoleSchema, staffUserSchema } from "@/lib/schemas";
import {
  CheckboxGroupField, Form, FormGrid, PasswordField, SelectField, SubmitButton, TextField,
} from "@/components/forms/form";

type Option = { value: string; label: string };
type ProjectOption = Option & { organization_id: string };

function ProjectPicker({ projects }: { projects: ProjectOption[] }) {
  const { control } = useFormContext();
  const orgId = useWatch({ control, name: "organization_id" }) as string;
  return (
    <div className="sm:col-span-2">
      <CheckboxGroupField
        name="project_ids"
        label="Erişebileceği projeler"
        options={projects.filter((p) => p.organization_id === orgId)}
        emptyText={
          orgId
            ? "Bu firmaya ait proje yok. Önce Projeler sayfasından proje ekleyin; hesabı projesiz de açabilirsiniz."
            : "Önce firmayı seçin."
        }
      />
    </div>
  );
}

/** Müşteri (firma) hesabı: firma + projeler + yetki düzeyi. Kullanıcı türü seçimi yok. */
export function CustomerUserForm({
  orgs, projects, customerRoles, defaultOrgId, defaultRoleId,
}: { orgs: Option[]; projects: ProjectOption[]; customerRoles: Option[]; defaultOrgId?: string; defaultRoleId?: string }) {
  return (
    <Form
      schema={customerUserSchema}
      defaultValues={{
        full_name: "", username: "", phone: "", password: "",
        organization_id: defaultOrgId ?? "",
        project_ids: defaultOrgId ? projects.filter((p) => p.organization_id === defaultOrgId).map((p) => p.value) : [],
        role_id: defaultRoleId ?? "",
      }}
      action={createCustomerUser}
      className="space-y-4 p-5"
    >
      <FormGrid>
        <TextField name="full_name" label="Ad soyad" required placeholder="Örn. Mehmet Yılmaz" />
        <TextField name="username" label="Kullanıcı adı" autoComplete="off" hint="Boş bırakırsanız addan üretilir (örn. mehmet-yilmaz)." />
        <FirmSelect orgs={orgs} projects={projects} />
        <SelectField name="role_id" label="Yetki düzeyi" options={customerRoles} placeholder="" hint="Sonradan kişiye özel izin ver / engelle ile ince ayar yapılabilir." />
        <ProjectPicker projects={projects} />
        <PasswordField name="password" label="Parola" autoComplete="new-password" hint="Boş bırakırsanız güvenli bir parola üretilir ve yalnızca bir kez gösterilir. En az 8 karakter." />
        <TextField name="phone" type="tel" label="Telefon" />
      </FormGrid>
      <SubmitButton>Müşteri hesabını oluştur</SubmitButton>
    </Form>
  );
}

function FirmSelect({ orgs, projects }: { orgs: Option[]; projects: ProjectOption[] }) {
  const { setValue } = useFormContext();
  return (
    <SelectField
      name="organization_id"
      label="Firma"
      options={orgs}
      required
      onValueChange={(v) => setValue("project_ids", projects.filter((p) => p.organization_id === v).map((p) => p.value))}
    />
  );
}

/** Merkez personeli: rol bir şablondur, kişiye özel yetkiler kullanıcı sayfasından verilir. */
export function StaffUserForm({ staffRoles }: { staffRoles: Option[] }) {
  return (
    <Form schema={staffUserSchema} defaultValues={{ full_name: "", username: "", phone: "", password: "", staff_role_id: "" }} action={createStaffUser} className="space-y-4 p-5">
      <FormGrid>
        <TextField name="full_name" label="Ad soyad" required />
        <TextField name="username" label="Kullanıcı adı" autoComplete="off" hint="Boşsa addan üretilir." />
        <SelectField name="staff_role_id" label="Başlangıç rolü (şablon)" options={staffRoles} required hint="Kişiye özel yetkileri oluşturduktan sonra kullanıcı sayfasından ayarlarsınız." />
        <PasswordField name="password" label="Parola" autoComplete="new-password" hint="Boşsa güvenli parola üretilir. En az 8 karakter." />
        <TextField name="phone" type="tel" label="Telefon" />
      </FormGrid>
      <SubmitButton>Merkez kullanıcısını oluştur</SubmitButton>
    </Form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  return (
    <Form schema={resetPasswordSchema} defaultValues={{ id: userId, password: "" }} action={resetPassword} className="space-y-3">
      <PasswordField name="password" label="Yeni parola" autoComplete="new-password" hint="Boş bırakırsanız güvenli parola üretilir." />
      <SubmitButton variant="secondary">Parolayı sıfırla</SubmitButton>
    </Form>
  );
}

export function StaffRoleForm({ userId, roleId, roles }: { userId: string; roleId: string; roles: Option[] }) {
  return (
    <Form schema={staffRoleSchema} defaultValues={{ id: userId, staff_role_id: roleId }} action={updateStaffRole} resetOnSuccess={false} className="space-y-3">
      <SelectField name="staff_role_id" label="Merkez rolü (şablon)" options={roles} placeholder="" className="max-w-sm" />
      <SubmitButton variant="secondary">Rolü güncelle</SubmitButton>
    </Form>
  );
}

export function MembershipForm({ userId, projects, roles, defaultRoleId }: { userId: string; projects: Option[]; roles: Option[]; defaultRoleId?: string }) {
  return (
    <Form schema={membershipSchema} defaultValues={{ user_id: userId, project_id: "", role_id: defaultRoleId ?? "" }} action={addMembership} className="space-y-4 p-5">
      <FormGrid cols={3}>
        <SelectField name="project_id" label="Proje" options={projects} required />
        <SelectField name="role_id" label="Rol" options={roles} placeholder="" required />
      </FormGrid>
      <SubmitButton>Erişim ver</SubmitButton>
    </Form>
  );
}
