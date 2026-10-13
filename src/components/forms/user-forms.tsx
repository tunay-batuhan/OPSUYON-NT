"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { addMembership, createUser, resetPassword, updateStaffRole } from "@/app/actions/users";
import { membershipSchema, resetPasswordSchema, staffRoleSchema, userSchema } from "@/lib/schemas";
import {
  CheckboxGroupField, Form, FormGrid, PasswordField, SelectField, SubmitButton, TextField,
} from "@/components/forms/form";

type Option = { value: string; label: string };
type ProjectOption = Option & { organization_id: string };

function CustomerFields({ projects, customerRoles, orgs }: { projects: ProjectOption[]; customerRoles: Option[]; orgs: Option[] }) {
  const { control, setValue } = useFormContext();
  const orgId = useWatch({ control, name: "organization_id" }) as string;
  const orgProjects = projects.filter((p) => p.organization_id === orgId);

  return (
    <>
      <SelectField
        name="organization_id"
        label="Firma"
        options={orgs}
        required
        onValueChange={(v) => setValue("project_ids", projects.filter((p) => p.organization_id === v).map((p) => p.value))}
      />
      <div className="sm:col-span-2">
        <CheckboxGroupField
          name="project_ids"
          label="Erişebileceği projeler"
          options={orgProjects}
          emptyText={
            orgId
              ? "Bu firmaya ait proje yok. Önce Projeler sayfasından proje ekleyin; hesabı projesiz de açabilirsiniz."
              : "Önce firmayı seçin."
          }
        />
      </div>
      <SelectField
        name="role_id"
        label="Yetki düzeyi"
        options={customerRoles}
        placeholder=""
        hint="Sonradan kişiye özel izin ver / engelle ile ince ayar yapılabilir."
      />
    </>
  );
}

export function UserForm({
  orgs, projects, customerRoles, staffRoles, defaultOrgId, defaultRoleId,
}: {
  orgs: Option[]; projects: ProjectOption[]; customerRoles: Option[]; staffRoles: Option[]; defaultOrgId?: string; defaultRoleId?: string;
}) {
  const [kind, setKind] = useState<"customer" | "staff">("customer");
  const defaults = {
    kind: "customer" as const,
    full_name: "",
    username: "",
    phone: "",
    password: "",
    organization_id: defaultOrgId ?? "",
    project_ids: defaultOrgId ? projects.filter((p) => p.organization_id === defaultOrgId).map((p) => p.value) : [],
    role_id: defaultRoleId ?? "",
    staff_role_id: "",
  };

  return (
    <Form schema={userSchema} defaultValues={defaults} action={createUser} className="space-y-4 p-5">
      <FormGrid>
        <TextField name="full_name" label="Ad soyad" required placeholder="Örn. Mehmet Yılmaz" />
        <TextField name="username" label="Kullanıcı adı" autoComplete="off" hint="Boş bırakırsanız addan üretilir (örn. mehmet-yilmaz)." />
        <SelectField
          name="kind"
          label="Kullanıcı türü"
          placeholder=""
          options={[{ value: "customer", label: "Müşteri (firma kullanıcısı)" }, { value: "staff", label: "Merkez personeli" }]}
          onValueChange={(v) => setKind(v as "customer" | "staff")}
        />
        {kind === "staff" ? (
          <SelectField name="staff_role_id" label="Merkez rolü" options={staffRoles} required />
        ) : (
          <CustomerFields projects={projects} customerRoles={customerRoles} orgs={orgs} />
        )}
        <PasswordField name="password" label="Parola" autoComplete="new-password" hint="Boş bırakırsanız güvenli bir parola üretilir ve yalnızca bir kez gösterilir. En az 8 karakter." />
        <TextField name="phone" type="tel" label="Telefon" />
      </FormGrid>
      <SubmitButton>Hesabı oluştur</SubmitButton>
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
      <SelectField name="staff_role_id" label="Merkez rolü" options={roles} placeholder="" className="max-w-sm" />
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
