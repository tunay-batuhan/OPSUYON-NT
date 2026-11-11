// Operasyon ekranlarının (Puantaj ekle, Yeni denetim ekle, İzin evrakı ekle) form şemaları.
// schemas.ts ile aynı kural: tüm alanlar string/boolean, böylece form girdisi ve çıktısı aynı tiptedir.
import { z } from "zod";
import { LEAVE_TYPES, date, decimal, month, opt, str, uuid, year } from "@/lib/schemas";

/** Tarayıcıdan Storage'a yüklenmiş dosyanın gizli alanları (FileArea doldurur). */
const fileFields = {
  storage_path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.string(),
};
const requiredFile = { ...fileFields, storage_path: z.string().min(1, "Önce bir dosya seçin") };

export const EMPTY_FILE = { storage_path: "", file_name: "", mime_type: "", size_bytes: "" } as const;
export type FileValues = { storage_path: string; file_name: string; mime_type: string; size_bytes: string };

/** Puantaj dosyası: proje + dönem; başlık sunucuda üretilir ("Puantaj AA/YYYY – Proje adı"). */
export const timesheetDocSchema = z.object({
  project_id: uuid("Proje"),
  period_month: month,
  period_year: year(),
  customer_visible: z.boolean(),
  ...requiredFile,
});

/** Denetim raporu: proje + denetim günü + vardiya; dönem tarihten türetilir. */
export const inspectionDocSchema = z.object({
  project_id: uuid("Proje"),
  inspection_date: date("Denetim tarihi", true).refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Geçerli bir denetim tarihi girin"),
  inspection_shift: z.string().refine((v) => ["gece", "gunduz"].includes(v), "Gece veya gündüz seçin"),
  customer_visible: z.boolean(),
  ...requiredFile,
});

/** İzin kaydı + (isteğe bağlı) imzalı izin evrakı tek seferde. */
export const leaveRecordDocSchema = z
  .object({
    assignment: z.string().min(1, "Personel seçin"), // "personelId|projeId"
    leave_type: z.enum(LEAVE_TYPES, "İzin türü seçin"),
    days: decimal("İzin süresi", { required: true, min: 0.5, max: 365 }),
    start_date: date("İzin başlangıç tarihi", true),
    end_date: date("İzin son tarihi", true),
    return_date: date("İşe dönüş tarihi", true),
    note: opt("Not", 300),
    /** Hafta tatili (yalnızca gün önerisi için; kaydedilmez): "0" Pazar, "6,0" Cumartesi+Pazar, "yok" … */
    weekly_rest: opt("Hafta tatili", 12),
    ...fileFields,
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { path: ["end_date"], message: "Son tarih, başlangıçtan önce olamaz" })
  .refine((v) => !v.end_date || !v.return_date || v.return_date > v.end_date, { path: ["return_date"], message: "İşe dönüş tarihi, izin son tarihinden sonra olmalı" })
  .refine((v) => !v.file_name || v.storage_path !== "", { path: ["storage_path"], message: "Evrak yükleniyor; bitince tekrar kaydedin" });

export type TimesheetDocValues = z.infer<typeof timesheetDocSchema>;
export type InspectionDocValues = z.infer<typeof inspectionDocSchema>;
export type LeaveRecordDocValues = z.infer<typeof leaveRecordDocSchema>;

/** Resmi tatil ekle (İzin Yönetimi > Resmi tatiller). */
export const holidaySchema = z.object({
  day: date("Tarih", true),
  name: str("Tatilin adı", 80),
  half: z.boolean(),
});
export type HolidayValues = z.infer<typeof holidaySchema>;
