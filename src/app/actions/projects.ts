"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toTitleCase } from "@/lib/format";
import {
  organizationSchema, organizationUpdateSchema, projectCreateSchema, projectUpdateSchema,
  type OrganizationUpdateValues, type OrganizationValues, type ProjectCreateValues, type ProjectUpdateValues,
} from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

export async function createOrganization(values: OrganizationValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("organizations.manage");
    const v = validate(organizationSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("organizations").insert({
      name: d.name,
      legal_name: nul(d.legal_name),
      tax_office: nul(d.tax_office),
      tax_no: nul(d.tax_no),
      address: nul(d.address),
      phone: nul(d.phone),
      email: nul(d.email),
    });
    if (error) {
      if (error.code === "23505") return { error: "Bu vergi numarasıyla kayıtlı bir firma var.", fieldErrors: { tax_no: "Bu vergi numarası zaten kayıtlı" } };
      return { error: pgMessage(error) };
    }
    revalidatePath("/merkez/firmalar");
    return { ok: true, message: "Firma oluşturuldu." };
  });
}

export async function setOrganizationStatus(fd: FormData): Promise<void> {
  await assertStaff("organizations.manage");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !status || !["active", "suspended", "archived"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("organizations").update({ status }).eq("id", id);
  revalidatePath("/merkez/firmalar");
}

export async function createProject(values: ProjectCreateValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("projects.manage");
    const v = validate(projectCreateSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: toTitleCase(d.name),
        organization_id: d.organization_id,
        service_line: d.service_line,
        code: nul(d.code),
        address: d.address ? toTitleCase(d.address) : null,
        start_date: nul(d.start_date),
        end_date: nul(d.end_date),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { error: "Bu proje kodu zaten kullanılıyor.", fieldErrors: { code: "Bu proje kodu zaten kullanılıyor" } };
      return { error: pgMessage(error) };
    }
    // Aksi halde yeni proje, firmanın mevcut hesaplarında görünmez: firmanın "Firma Yöneticisi" hesaplarına erişim ver.
    const granted = await grantProjectToFirmManagers(data.id as string, d.organization_id);
    revalidatePath("/merkez/projeler");
    redirect(`/projeler/${data.id}${granted ? `?erisim=${granted}` : ""}`);
  });
}

export async function updateProject(values: ProjectUpdateValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("projects.manage");
    const v = validate(projectUpdateSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({
        name: toTitleCase(d.name),
        status: d.status,
        code: nul(d.code),
        address: d.address ? toTitleCase(d.address) : null,
        start_date: nul(d.start_date),
        end_date: nul(d.end_date),
        notes: nul(d.notes),
      })
      .eq("id", d.id);
    if (error) {
      if (error.code === "23505") return { error: "Bu proje kodu zaten kullanılıyor.", fieldErrors: { code: "Bu proje kodu zaten kullanılıyor" } };
      return { error: pgMessage(error) };
    }
    revalidatePath(`/projeler/${d.id}`, "layout");
    return { ok: true, message: "Proje güncellendi." };
  });
}

export async function updateOrganization(values: OrganizationUpdateValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("organizations.manage");
    const v = validate(organizationUpdateSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase
      .from("organizations")
      .update({
        name: d.name,
        legal_name: nul(d.legal_name),
        tax_office: d.tax_office,
        tax_no: d.tax_no,
        address: d.address,
        phone: d.phone,
        email: nul(d.email),
      })
      .eq("id", d.id);
    if (error) {
      if (error.code === "23505") return { error: "Bu vergi numarasıyla kayıtlı başka bir firma var.", fieldErrors: { tax_no: "Bu vergi numarası zaten kayıtlı" } };
      return { error: pgMessage(error) };
    }
    revalidatePath("/merkez/firmalar");
    revalidatePath(`/merkez/firmalar/${d.id}`);
    return { ok: true, message: "Firma bilgileri güncellendi." };
  });
}

/**
 * Firmanın (başka projelerinde) "Firma Yöneticisi" rolündeki aktif hesaplarını yeni projeye de ekler.
 * Yetki kontrolü çağıranda yapılır (projects.manage); üyelik tablosu için yönetici istemci kullanılır.
 */
async function grantProjectToFirmManagers(projectId: string, organizationId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: role } = await admin.from("roles").select("id").eq("code", "customer_manager").maybeSingle();
  if (!role) return 0;
  const { data: others } = await admin.from("projects").select("id").eq("organization_id", organizationId).neq("id", projectId);
  const ids = (others ?? []).map((p) => p.id as string);
  if (ids.length === 0) return 0;
  const { data: members } = await admin.from("project_members").select("user_id").in("project_id", ids).eq("role_id", role.id);
  const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  if (userIds.length === 0) return 0;
  const { data: profiles } = await admin.from("profiles").select("id").in("id", userIds).eq("kind", "customer").eq("is_active", true).eq("organization_id", organizationId);
  const rows = (profiles ?? []).map((p) => ({ project_id: projectId, user_id: p.id as string, role_id: role.id as string }));
  if (rows.length === 0) return 0;
  const { error } = await admin.from("project_members").insert(rows);
  return error ? 0 : rows.length;
}
