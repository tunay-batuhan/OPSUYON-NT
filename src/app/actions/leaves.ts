"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toNumber } from "@/lib/parse";
import { leaveRecordSchema, type LeaveRecordValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

const UUID = /^[0-9a-f-]{36}$/i;

export async function createLeaveRecord(values: LeaveRecordValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("leaves.manage");
    const v = validate(leaveRecordSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const [personnel_id, project_id] = d.assignment.split("|");
    if (!UUID.test(personnel_id ?? "") || !UUID.test(project_id ?? "")) return { error: "Personel seçimi geçersiz.", fieldErrors: { assignment: "Geçersiz seçim" } };

    const supabase = await createClient();
    const { error } = await supabase.from("leave_records").insert({
      personnel_id,
      project_id,
      leave_type: d.leave_type,
      start_date: d.start_date,
      end_date: d.end_date,
      return_date: d.return_date,
      days: toNumber(d.days),
      note: nul(d.note),
      created_by: actor.id,
    });
    if (error) return { error: pgMessage(error) };
    revalidatePath("/izinler");
    return { ok: true, message: "İzin kaydedildi." };
  });
}

export async function deleteLeaveRecord(fd: FormData): Promise<void> {
  await assertStaff("leaves.manage");
  const id = str(fd, "id");
  if (!id || !UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("leave_records").delete().eq("id", id);
  revalidatePath("/izinler");
}

/** İzin evrakı: dosya zaten Storage'a yüklendi; belge kaydını oluşturup izne bağlar. */
export async function attachLeaveDocument(input: {
  recordId: string; path: string; fileName: string; mimeType: string; size: number;
}): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("leaves.manage");
    if (!UUID.test(input.recordId) || !input.path || !input.fileName) return { error: "Geçersiz istek." };

    const supabase = await createClient();
    const { data: rec } = await supabase.from("leave_records").select("id, personnel_id, project_id, start_date").eq("id", input.recordId).maybeSingle();
    if (!rec || !rec.project_id) return { error: "İzin kaydı bulunamadı." };
    if (!input.path.startsWith(`${rec.project_id}/`)) return { error: "Geçersiz dosya yolu." };

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        project_id: rec.project_id,
        personnel_id: rec.personnel_id,
        category_code: "yillik_izin",
        title: `İzin evrakı (${rec.start_date})`,
        storage_path: input.path,
        file_name: input.fileName,
        mime_type: nul(input.mimeType),
        size_bytes: input.size,
        customer_visible: true,
        uploaded_by: actor.id,
      })
      .select("id")
      .single();
    if (error) return { error: pgMessage(error) };

    const { error: uErr } = await supabase.from("leave_records").update({ document_id: doc.id }).eq("id", rec.id);
    if (uErr) return { error: pgMessage(uErr) };
    revalidatePath("/izinler");
    return { ok: true, message: "Evrak yüklendi." };
  });
}
