"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, pgMessage } from "@/lib/form";
import type { ActionState } from "@/lib/action-types";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ShiftEntry = { personnelId: string; date: string; code: string };

/** Paint / erase one or many cells. code "" removes the assignment. */
export async function setShifts(input: { projectId: string; entries: ShiftEntry[] }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("shifts.manage");
    const { projectId, entries } = input;
    if (!UUID.test(projectId) || !Array.isArray(entries) || entries.length === 0 || entries.length > 500) return { error: "Geçersiz istek." };
    for (const e of entries) {
      if (!UUID.test(e.personnelId) || !DATE.test(e.date) || !/^[A-Z0-9]{0,3}$/.test(e.code)) return { error: "Geçersiz kayıt." };
    }

    const supabase = await createClient();
    const upserts = entries.filter((e) => e.code !== "").map((e) => ({ project_id: projectId, personnel_id: e.personnelId, work_date: e.date, shift_code: e.code }));
    const deletes = entries.filter((e) => e.code === "");

    if (upserts.length) {
      const { error } = await supabase.from("shift_assignments").upsert(upserts, { onConflict: "project_id,personnel_id,work_date" });
      if (error) return { error: pgMessage(error) };
    }
    for (const d of deletes) {
      const { error } = await supabase.from("shift_assignments").delete().eq("project_id", projectId).eq("personnel_id", d.personnelId).eq("work_date", d.date);
      if (error) return { error: pgMessage(error) };
    }
    return { ok: true };
  });
}

/** Turns the month's roster into timesheet rows: working shifts → worked days, annual leave / sick leave → leave days. */
export async function applyShiftsToTimesheet(input: { projectId: string; year: number; month: number }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("timesheets.manage");
    const { projectId, year, month } = input;
    if (!UUID.test(projectId) || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return { error: "Geçersiz dönem." };

    const supabase = await createClient();
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const to = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

    const [{ data: rows, error }, { data: types }] = await Promise.all([
      supabase.from("shift_assignments").select("personnel_id, shift_code").eq("project_id", projectId).gte("work_date", from).lte("work_date", to),
      supabase.from("shift_types").select("code, is_off"),
    ]);
    if (error) return { error: pgMessage(error) };
    if (!rows?.length) return { error: "Bu ay için vardiya planı boş." };

    const off = new Set((types ?? []).filter((t) => t.is_off).map((t) => t.code as string));
    const leaveCodes = new Set(["Y", "R"]);
    const perPerson = new Map<string, { worked: number; leave: number }>();
    for (const r of rows) {
      const id = r.personnel_id as string;
      const acc = perPerson.get(id) ?? { worked: 0, leave: 0 };
      if (!off.has(r.shift_code as string)) acc.worked += 1;
      else if (leaveCodes.has(r.shift_code as string)) acc.leave += 1;
      perPerson.set(id, acc);
    }

    const payload = [...perPerson.entries()].map(([personnel_id, v]) => ({
      project_id: projectId, personnel_id, period_year: year, period_month: month, worked_days: v.worked, leave_days: v.leave,
    }));
    // keep absence/overtime already entered: only touch the two columns we computed
    const { error: uErr } = await supabase.from("timesheets").upsert(payload, { onConflict: "project_id,personnel_id,period_year,period_month" });
    if (uErr) return { error: pgMessage(uErr) };
    revalidatePath(`/projeler/${projectId}/puantaj`);
    revalidatePath("/puantaj");
    return { ok: true, message: `${payload.length} personelin puantajı vardiya planından güncellendi.` };
  });
}
