import type { SupabaseClient } from "@supabase/supabase-js";

// Türler, etiketler ve okuma yardımcısı (istemci bileşenleri yalnızca tür/etiketleri kullanır).

export type TaskDetail = {
  id: string;
  project_id: string;
  personnel_id: string;
  title: string;
  job: string | null;
  description: string | null;
  location: string | null;
  planned_date: string | null;
  planned_time: string | null;
  status: string;
  issue_note: string | null;
  issue_at: string | null;
  accepted_at: string | null;
  finished_by_personnel_at: string | null;
  finish_note: string | null;
  completed_at: string | null;
  created_at: string;
  personnel: { full_name: string } | null;
  projects: { name: string; organizations: { name: string } | null } | null;
};
export type TaskEvent = { id: number; kind: string; actor_name: string | null; note: string | null; created_at: string };
export type TaskFile = { id: string; stage: string; file_name: string; mime_type: string | null; size_bytes: number | null; created_at: string };

const COLUMNS =
  "id, project_id, personnel_id, title, job, description, location, planned_date, planned_time, status, issue_note, issue_at, accepted_at, finished_by_personnel_at, finish_note, completed_at, created_at, personnel(full_name), projects(name, organizations(name))";

/** Görev + olay geçmişi + dosyalar. `db`: kullanıcı oturumu (RLS) ya da süzgeci sunucuda verilmiş servis istemcisi. */
export async function loadTaskDetail(db: SupabaseClient, id: string): Promise<{ task: TaskDetail; events: TaskEvent[]; files: TaskFile[] } | null> {
  const { data } = await db.from("work_tasks").select(COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const [{ data: ev }, { data: fl }] = await Promise.all([
    db.from("work_task_events").select("id, kind, actor_name, note, created_at").eq("task_id", id).order("id"),
    db.from("work_task_files").select("id, stage, file_name, mime_type, size_bytes, created_at").eq("task_id", id).order("created_at"),
  ]);
  return { task: data as unknown as TaskDetail, events: (ev ?? []) as TaskEvent[], files: (fl ?? []) as TaskFile[] };
}

export const EVENT_LABELS: Record<string, string> = {
  created: "Görev atandı",
  updated: "Görev bilgileri güncellendi",
  reassigned: "Başka personele verildi",
  accepted: "Personel kabul etti",
  issue: "Personel sorun bildirdi",
  scheduled: "Tarih / saat verildi",
  finished: "Personel işi bitirdiğini bildirdi",
  completed: "Tamamlandı olarak kapatıldı",
  reopened: "Yeniden açıldı",
  resent: "Personele yeniden onaya gönderildi",
  cancelled: "İptal edildi",
  file: "Dosya eklendi",
};

export const FILE_STAGE_LABELS: Record<string, string> = { assign: "Atamada eklendi", issue: "Sorun bildirirken", finish: "İş bitince" };

export const isImageFile = (f: Pick<TaskFile, "file_name" | "mime_type">) =>
  (f.mime_type ?? "").startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.file_name);
