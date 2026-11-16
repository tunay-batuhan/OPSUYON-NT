"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser, hasPermission, type CurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { supabasePublicKey } from "@/lib/supabase/env";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { slugify } from "@/lib/format";
import { isUuid } from "@/lib/lookups";
import { scheduleSchema, taskFileExt, taskSchema, TASK_FILE_MAX, type ScheduleValues, type TaskValues } from "@/lib/schemas-tasks";
import type { ActionState } from "@/lib/action-types";

/**
 * İş Planlama işlemleri. Yazmalar kullanıcının kendi oturumuyla yapılır: kuralları veritabanı uygular
 * (RLS: projede "tasks.assign"; görev yalnızca projedeki aktif personele; personel yanıtı task_respond ile).
 * Dosyalar (fotoğraf / PDF) 'documents' kovasında tasks/{görev}/… altına imzalı adresle doğrudan yüklenir.
 */

const BUCKET = "documents";

async function canAssign(user: CurrentUser | null, projectId: string): Promise<boolean> {
  if (!user) return false;
  if (user.kind === "staff") return hasPermission(user, "tasks.assign");
  if (user.kind !== "customer") return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_project_permissions", { p_project_id: projectId });
  return ((data as string[] | null) ?? []).includes("tasks.assign");
}

function refresh(id?: string) {
  revalidatePath("/is-planlama");
  if (id) revalidatePath(`/is-planlama/${id}`);
  revalidatePath("/gorevlerim");
}

type TaskRow = { id: string; project_id: string; personnel_id: string; status: string; accepted_at: string | null };

async function readTask(id: string): Promise<TaskRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("work_tasks").select("id, project_id, personnel_id, status, accepted_at").eq("id", id).maybeSingle();
  return (data as TaskRow | null) ?? null;
}

export type SaveTaskResult = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; id?: string } | null;

/** Yeni görev ya da düzenleme. Sorun bildirilmiş görev düzeltilince (ya da personel değişince) yeniden onaya gider. */
export async function saveTask(values: TaskValues): Promise<SaveTaskResult> {
  try {
    return await saveTaskInner(values);
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu." };
  }
}

async function saveTaskInner(values: TaskValues): Promise<SaveTaskResult> {
  {
    const v = validate(taskSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const user = await getCurrentUser();
    if (!(await canAssign(user, d.project_id))) return { error: "Bu projede görev atama yetkiniz yok." };
    const supabase = await createClient();
    const fields = {
      personnel_id: d.personnel_id,
      title: d.title,
      job: nul(d.job),
      description: nul(d.description),
      location: nul(d.location),
      planned_date: nul(d.planned_date),
      planned_time: nul(d.planned_date) ? nul(d.planned_time) : null,
    };

    if (!d.id) {
      const { data, error } = await supabase.from("work_tasks").insert({ project_id: d.project_id, ...fields }).select("id").single();
      if (error) return { error: pgMessage(error) };
      refresh(data.id);
      return { ok: true, id: data.id, message: "Görev atandı. Personel telefonunda görüp kabul edecek." };
    }

    const current = await readTask(d.id);
    if (!current) return { error: "Görev bulunamadı." };
    if (current.project_id !== d.project_id) return { error: "Görevin projesi değiştirilemez." };
    if (current.status === "done" || current.status === "cancelled") return { error: "Tamamlanan ya da iptal edilen görev düzenlenemez; önce geri alın." };
    const reassigned = current.personnel_id !== d.personnel_id;
    const resend = current.status === "issue" || (reassigned && current.status === "accepted");
    const { error } = await supabase.from("work_tasks").update({ ...fields, ...(resend ? { status: "pending" } : {}) }).eq("id", d.id);
    if (error) return { error: pgMessage(error) };
    refresh(d.id);
    return {
      ok: true,
      id: d.id,
      message: resend ? "Görev güncellendi ve personele yeniden onaya gönderildi." : "Görev güncellendi.",
    };
  }
}

export async function scheduleTask(values: ScheduleValues): Promise<ActionState> {
  return guard(async () => {
    const v = validate(scheduleSchema, values);
    if (!v.ok) return v.state;
    const current = await readTask(v.data.id);
    if (!current) return { error: "Görev bulunamadı." };
    if (current.status === "done" || current.status === "cancelled") return { error: "Tamamlanan ya da iptal edilen göreve tarih verilemez." };
    const supabase = await createClient();
    const planned_date = nul(v.data.planned_date);
    const { error, count } = await supabase
      .from("work_tasks")
      .update({ planned_date, planned_time: planned_date ? nul(v.data.planned_time) : null }, { count: "exact" })
      .eq("id", v.data.id);
    if (error) return { error: pgMessage(error) };
    if (!count) return { error: "Bu görevde değişiklik yetkiniz yok." };
    refresh(v.data.id);
    return { ok: true, message: planned_date ? "Tarih ve saat kaydedildi." : "Tarih kaldırıldı." };
  });
}

const NEXT: Record<string, { from: string[]; to: string; ok: string }> = {
  complete: { from: ["pending", "issue", "accepted"], to: "done", ok: "Görev tamamlandı olarak kapatıldı." },
  reopen: { from: ["done", "cancelled"], to: "accepted", ok: "Görev yeniden açıldı." },
  cancel: { from: ["pending", "issue", "accepted"], to: "cancelled", ok: "Görev iptal edildi." },
  resend: { from: ["issue", "accepted"], to: "pending", ok: "Görev personele yeniden onaya gönderildi." },
};

/** Tamamlandı · Geri al · İptal · Yeniden onaya gönder (görev sayfasındaki düğmeler). */
export async function setTaskStatus(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const op = str(fd, "op") ?? "";
  const rule = NEXT[op];
  if (!id || !isUuid(id) || !rule) return;
  const current = await readTask(id);
  if (!current || !rule.from.includes(current.status)) return;
  // iptal edilmiş (ya da personel hiç kabul etmeden kapatılmış) görev geri alınınca personelin yeniden onayı gerekir
  const to = op === "reopen" && (current.status === "cancelled" || !current.accepted_at) ? "pending" : rule.to;
  const supabase = await createClient();
  await supabase.from("work_tasks").update({ status: to }).eq("id", id);
  refresh(id);
}

export async function deleteTask(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  if (!id || !isUuid(id)) return;
  const current = await readTask(id);
  if (!current) return;
  const user = await getCurrentUser();
  if (!(await canAssign(user, current.project_id))) return;
  const supabase = await createClient();
  const { data: files } = await supabase.from("work_task_files").select("storage_path").eq("task_id", id);
  const { error } = await supabase.from("work_tasks").delete().eq("id", id);
  if (error) return;
  const paths = ((files ?? []) as { storage_path: string }[]).map((f) => f.storage_path);
  if (paths.length) await createAdminClient().storage.from(BUCKET).remove(paths);
  refresh();
  redirect("/is-planlama?silindi=1");
}

/* ------------------------------ personel yanıtı ------------------------------ */

export async function respondTask(input: { id: string; action: "accept" | "issue" | "finish"; note?: string }): Promise<ActionState> {
  return guard(async () => {
    if (!isUuid(input.id) || !["accept", "issue", "finish"].includes(input.action)) return { error: "Geçersiz istek." };
    const user = await getCurrentUser();
    if (!user || user.kind !== "personnel") return { error: "Bu işlem yalnızca personel hesabıyla yapılabilir." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("task_respond", { p_task: input.id, p_action: input.action, p_note: input.note ?? null });
    if (error) return { error: error.message };
    refresh(input.id);
    return {
      ok: true,
      message: input.action === "accept" ? "Görevi kabul ettiniz." : input.action === "issue" ? "Sorun bildirildi; müdürünüz görecek." : "İşi bitirdiniz; müdürünüz onaylayacak.",
    };
  });
}

/* ------------------------------ dosyalar ------------------------------ */

type UploadRole = { role: "manager" | "personnel"; status: string } | null;

/** Dosya ekleyebilir mi? Müdür: projede tasks.assign. Personel: yalnızca kendi görevi. */
async function uploadRole(user: CurrentUser | null, taskId: string): Promise<UploadRole> {
  if (!user || !isUuid(taskId)) return null;
  if (user.kind === "personnel") {
    const { data } = await createAdminClient().from("work_tasks").select("status, personnel_id").eq("id", taskId).maybeSingle();
    if (!data || data.personnel_id !== user.personnel_id) return null;
    return ["pending", "issue", "accepted"].includes(data.status) ? { role: "personnel", status: data.status } : null;
  }
  const task = await readTask(taskId);
  if (!task || !(await canAssign(user, task.project_id))) return null;
  return { role: "manager", status: task.status };
}

export type PreparedTaskUpload = { path: string; signedUrl: string; anonKey: string } | { error: string };

export async function prepareTaskUpload(input: { taskId: string; fileName: string; mime?: string; size: number }): Promise<PreparedTaskUpload> {
  try {
    const role = await uploadRole(await getCurrentUser(), input.taskId);
    if (!role) return { error: "Bu göreve dosya ekleme yetkiniz yok." };
    const ext = taskFileExt(input.fileName, input.mime);
    if (!ext) return { error: "Yalnızca fotoğraf (JPG, PNG, WEBP, HEIC) ya da PDF eklenebilir." };
    if (!(input.size > 0 && input.size <= TASK_FILE_MAX)) return { error: "Dosya 50 MB'tan büyük olamaz." };
    const base = slugify(input.fileName.replace(/\.[^.]+$/, "")).slice(0, 60) || "dosya";
    const path = `tasks/${input.taskId}/${randomUUID()}-${base}.${ext}`;
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? "Yükleme hazırlanamadı." };
    return { path, signedUrl: data.signedUrl, anonKey: supabasePublicKey() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yükleme hazırlanamadı." };
  }
}

export async function registerTaskFile(input: { taskId: string; path: string; fileName: string; mime: string; size: number; stage?: "issue" | "finish" }): Promise<ActionState> {
  return guard(async () => {
    const user = await getCurrentUser();
    const role = await uploadRole(user, input.taskId);
    const admin = createAdminClient(user?.id);
    const drop = async (message: string) => {
      if (input.path.startsWith(`tasks/${input.taskId}/`)) await admin.storage.from(BUCKET).remove([input.path]);
      return { error: message };
    };
    if (!role) return drop("Bu göreve dosya ekleme yetkiniz yok.");
    if (!input.path.startsWith(`tasks/${input.taskId}/`) || input.path.includes("..")) return { error: "Geçersiz dosya yolu." };
    const stage = role.role === "manager" ? "assign" : input.stage === "finish" ? "finish" : "issue";
    const { error } = await admin.from("work_task_files").insert({
      task_id: input.taskId,
      stage,
      storage_path: input.path,
      file_name: input.fileName.slice(0, 255),
      mime_type: input.mime.slice(0, 100) || null,
      size_bytes: input.size > 0 ? input.size : null,
      uploaded_by: user!.id,
    });
    if (error) return drop(pgMessage(error));
    refresh(input.taskId);
    return { ok: true, message: "Dosya eklendi." };
  });
}

export async function removeTaskFile(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  if (!id || !isUuid(id)) return;
  const supabase = await createClient();
  const { data: file } = await supabase.from("work_task_files").select("task_id, storage_path").eq("id", id).maybeSingle();
  if (!file) return;
  const role = await uploadRole(await getCurrentUser(), file.task_id as string);
  if (role?.role !== "manager") return;
  const admin = createAdminClient();
  const { error } = await admin.from("work_task_files").delete().eq("id", id);
  if (!error) await admin.storage.from(BUCKET).remove([file.storage_path as string]);
  refresh(file.task_id as string);
}
