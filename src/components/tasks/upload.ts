"use client";

import { prepareTaskUpload, registerTaskFile } from "@/app/actions/tasks";
import { TASK_FILE_MAX, taskFileExt } from "@/lib/schemas-tasks";

/** Görev dosyasını imzalı adresle doğrudan Storage'a yükler ve göreve bağlar. Hata olursa mesajla fırlatır. */
export async function uploadTaskFile(taskId: string, file: File, stage?: "issue" | "finish"): Promise<void> {
  if (!taskFileExt(file.name, file.type)) throw new Error(`${file.name}: yalnızca fotoğraf (JPG, PNG, WEBP, HEIC) ya da PDF eklenebilir`);
  if (file.size === 0) throw new Error(`${file.name}: dosya boş`);
  if (file.size > TASK_FILE_MAX) throw new Error(`${file.name}: dosya 50 MB'tan büyük olamaz`);
  const prep = await prepareTaskUpload({ taskId, fileName: file.name, mime: file.type, size: file.size });
  if ("error" in prep) throw new Error(prep.error);
  // supabase-js `uploadToSignedUrl` ile aynı istek (istemci paketlenmeden)
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(prep.signedUrl, { method: "PUT", body, headers: { apikey: prep.anonKey, "x-upsert": "false" } });
  if (!res.ok) throw new Error(`${file.name}: yüklenemedi`);
  const reg = await registerTaskFile({ taskId, path: prep.path, fileName: file.name, mime: file.type, size: file.size, stage });
  if (reg?.error) throw new Error(reg.error);
}
