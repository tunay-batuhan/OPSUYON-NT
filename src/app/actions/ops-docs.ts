"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, validate } from "@/lib/form";
import { registerDocument } from "@/app/actions/documents";
import {
  inspectionDocSchema, timesheetDocSchema,
  type InspectionDocValues, type TimesheetDocValues,
} from "@/lib/schemas-ops";
import type { ActionState } from "@/lib/action-types";

const SHIFT: Record<string, string> = { gece: "Gece", gunduz: "Gündüz" };

/** Belge başlığı en fazla 140 karakter (documentSchema). */
const fit = (s: string) => (s.length > 140 ? `${s.slice(0, 139)}…` : s);

async function projectName(projectId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", projectId).maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

const notFoundProject = { error: "Proje bulunamadı.", fieldErrors: { project_id: "Proje bulunamadı" } };

/** Puantaj ekle: dosya Storage'da; başlık "Puantaj AA/YYYY – Proje adı" olarak üretilir. */
export async function addTimesheetDocument(values: TimesheetDocValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("documents.manage");
    const v = validate(timesheetDocSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const name = await projectName(d.project_id);
    if (!name) return notFoundProject;

    const month = Number(d.period_month);
    const year = Number(d.period_year);
    const title = fit(`Puantaj ${String(month).padStart(2, "0")}/${year} – ${name}`);
    const res = await registerDocument({
      project_id: d.project_id, category_code: "puantaj", title, personnel_id: "",
      period_month: String(month), period_year: String(year), description: "", customer_visible: d.customer_visible,
      storage_path: d.storage_path, file_name: d.file_name, mime_type: d.mime_type, size_bytes: d.size_bytes,
      inspection_date: "", inspection_shift: "",
    });
    if (!res?.ok) return res;
    revalidatePath("/puantaj");
    return { ok: true, message: `Puantaj eklendi: ${title}` };
  });
}

/** Yeni denetim ekle: başlık "Denetim Raporu GG.AA.YYYY Gece/Gündüz – Proje"; dönem tarihten türetilir. */
export async function addInspectionDocument(values: InspectionDocValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("documents.manage");
    const v = validate(inspectionDocSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const name = await projectName(d.project_id);
    if (!name) return notFoundProject;

    const [y, m, day] = d.inspection_date.split("-");
    const title = fit(`Denetim Raporu ${day}.${m}.${y} ${SHIFT[d.inspection_shift]} – ${name}`);
    const res = await registerDocument({
      project_id: d.project_id, category_code: "denetim", title, personnel_id: "",
      period_month: "", period_year: "", description: "", customer_visible: d.customer_visible,
      storage_path: d.storage_path, file_name: d.file_name, mime_type: d.mime_type, size_bytes: d.size_bytes,
      inspection_date: d.inspection_date, inspection_shift: d.inspection_shift,
    });
    if (!res?.ok) return res;
    revalidatePath("/denetimler");
    return { ok: true, message: `Denetim raporu eklendi: ${title}` };
  });
}
