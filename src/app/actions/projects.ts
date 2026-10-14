"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
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
    revalidatePath("/merkez/projeler");
    redirect(`/projeler/${data.id}`);
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
