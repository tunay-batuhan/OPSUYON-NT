// İş Planlama formları: tarayıcıda (react-hook-form) ve sunucuda (action) aynı şema.
import { z } from "zod";
import { date, opt, str, uuid } from "@/lib/schemas";

const time = z
  .string()
  .trim()
  .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Saat SS:DD biçiminde olmalı (ör. 09:00)");

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Yeni görev (Yeni Görev Atama) ve düzenleme. Tarih/saat isteğe bağlı: kabulden sonra da verilebilir.
 * target "field": projedeki saha personeline (proje + personel zorunlu). target "staff": merkez kullanıcısına
 * (yalnızca merkez atar; proje ve personel boş kalır).
 */
export const taskSchema = z
  .object({
    id: z.string(),
    target: z.enum(["field", "staff"]),
    project_id: z.string(),
    personnel_id: z.string(),
    assignee_id: z.string(),
    title: str("Görev başlığı", 160).refine((v) => v.length >= 2, "Görev başlığı en az 2 karakter olmalı"),
    job: opt("Görevi", 80),
    description: opt("Görev açıklaması", 4000),
    location: opt("Görev yeri", 160),
    planned_date: date("Tarih"),
    planned_time: time,
  })
  .superRefine((v, ctx) => {
    const need = (path: "project_id" | "personnel_id" | "assignee_id", label: string) => {
      if (!UUID.test(v[path])) ctx.addIssue({ code: "custom", path: [path], message: `${label} seçin` });
    };
    if (v.target === "staff") need("assignee_id", "Merkez kullanıcısı");
    else {
      need("project_id", "Proje");
      need("personnel_id", "Personel");
    }
    if (v.planned_time !== "" && v.planned_date === "") ctx.addIssue({ code: "custom", path: ["planned_date"], message: "Saat verdiyseniz tarihi de seçin" });
  });

/** Tarih / saat ver (Planla). */
export const scheduleSchema = z
  .object({ id: uuid("Görev"), planned_date: date("Tarih"), planned_time: time })
  .refine((v) => v.planned_time === "" || v.planned_date !== "", { path: ["planned_date"], message: "Saat verdiyseniz tarihi de seçin" });

export type TaskValues = z.infer<typeof taskSchema>;
export type ScheduleValues = z.infer<typeof scheduleSchema>;

/**
 * Görev dosyası: fotoğraf ya da PDF, en fazla 50 MB. "image/*": iPhone galeriden seçilen HEIC fotoğrafı
 * yüklerken JPEG'e çevirir (tüm tarayıcılarda görünür); kamera da doğrudan açılabilir.
 */
export const TASK_FILE_ACCEPT = "image/*,application/pdf,.pdf";
export const TASK_FILE_MAX = 50 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf",
};
/** Dosya uzantısı (adından; adında yoksa türünden — telefon kamerası bazen uzantısız ad verir). Desteklenmiyorsa null. */
export const taskFileExt = (name: string, mime?: string) => {
  const m = name.toLowerCase().match(/\.(jpe?g|png|webp|gif|heic|heif|pdf)$/);
  return m ? m[1] : (mime && MIME_EXT[mime.toLowerCase()]) || null;
};
