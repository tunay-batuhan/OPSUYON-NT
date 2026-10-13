"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { normalizeIban, toNumber } from "@/lib/parse";
import {
  assignSchema, leaveSchema, personnelSchema, timesheetSchema,
  type AssignValues, type LeaveValues, type PersonnelValues, type TimesheetValues,
} from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

export async function createPersonnel(values: PersonnelValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("personnel.manage");
    const v = validate(personnelSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const hasPrivate = Boolean(d.national_id || d.iban);
    if (hasPrivate && !(actor.roleCode === "super_admin" || actor.permissions.includes("personnel.sensitive.read"))) {
      return { error: "TC kimlik / IBAN girmek için yetkiniz yok.", fieldErrors: { national_id: "Bu alan için yetkiniz yok" } };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("personnel")
      .insert({
        first_name: d.first_name,
        last_name: d.last_name,
        employee_no: nul(d.employee_no),
        title: nul(d.title),
        service_line: nul(d.service_line),
        phone: nul(d.phone),
        email: nul(d.email),
        hire_date: nul(d.hire_date),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { error: "Bu sicil numarası zaten kullanılıyor.", fieldErrors: { employee_no: "Bu sicil numarası zaten kullanılıyor" } };
      return { error: pgMessage(error) };
    }

    if (hasPrivate) {
      const { error: pErr } = await supabase
        .from("personnel_private")
        .insert({ personnel_id: data.id, national_id: nul(d.national_id), iban: d.iban ? normalizeIban(d.iban) : null });
      if (pErr) return { error: pgMessage(pErr) };
    }
    revalidatePath("/merkez/personel");
    return { ok: true, message: "Personel eklendi." };
  });
}

export async function assignPersonnel(values: AssignValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("personnel.manage");
    const v = validate(assignSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("personnel_assignments").insert({
      project_id: d.project_id,
      personnel_id: d.personnel_id,
      position: nul(d.position),
      shift: nul(d.shift),
      start_date: nul(d.start_date) ?? new Date().toISOString().slice(0, 10),
    });
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/projeler/${d.project_id}`, "layout");
    return { ok: true, message: "Personel projeye atandı." };
  });
}

export async function endAssignment(fd: FormData): Promise<void> {
  await assertStaff("personnel.manage");
  const id = str(fd, "id");
  const project_id = str(fd, "project_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("personnel_assignments").update({ end_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
  if (project_id) revalidatePath(`/projeler/${project_id}`, "layout");
}

export async function upsertTimesheet(values: TimesheetValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("timesheets.manage");
    const v = validate(timesheetSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("timesheets").upsert(
      {
        project_id: d.project_id,
        personnel_id: d.personnel_id,
        period_year: toNumber(d.period_year),
        period_month: toNumber(d.period_month),
        worked_days: toNumber(d.worked_days) ?? 0,
        leave_days: toNumber(d.leave_days) ?? 0,
        absence_days: toNumber(d.absence_days) ?? 0,
        overtime_hours: toNumber(d.overtime_hours) ?? 0,
        note: nul(d.note),
      },
      { onConflict: "project_id,personnel_id,period_year,period_month" },
    );
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/projeler/${d.project_id}/puantaj`);
    return { ok: true, message: "Puantaj kaydedildi." };
  });
}

export async function upsertLeaveBalance(values: LeaveValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("leaves.manage");
    const v = validate(leaveSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("leave_balances").upsert(
      {
        personnel_id: d.personnel_id,
        year: toNumber(d.year),
        entitled_days: toNumber(d.entitled_days) ?? 0,
        carried_days: toNumber(d.carried_days) ?? 0,
        used_days: toNumber(d.used_days) ?? 0,
      },
      { onConflict: "personnel_id,year" },
    );
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/projeler/${d.project_id}/izinler`);
    return { ok: true, message: "İzin bakiyesi kaydedildi." };
  });
}
