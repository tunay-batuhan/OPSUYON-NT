// Single source of truth for form validation: the SAME schemas run in the
// browser (react-hook-form resolver) and on the server (inside every action).
// All fields are strings/booleans/string[] so form input and output types match;
// numeric strings are converted with toNumber() after validation.
import { z } from "zod";
import { isTaxNo, isValidIban, isValidTckn, toNumber } from "@/lib/parse";

z.config(z.locales.tr());

/* ------------------------------ building blocks ------------------------------ */
const str = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} zorunlu`).max(max, `${label} en fazla ${max} karakter olabilir`);
const opt = (label: string, max = 200) => z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir`);
const uuid = (label: string) => z.string().min(1, `${label} seçin`).regex(/^[0-9a-f-]{36}$/i, `${label} geçersiz`);

const date = (label: string, required = false) =>
  z
    .string()
    .trim()
    .refine((v) => (required ? v !== "" : true), `${label} zorunlu`)
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), `${label} geçerli bir tarih olmalı`);

const decimal = (label: string, opts: { required?: boolean; min?: number; max?: number } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => !opts.required || v !== "", `${label} zorunlu`)
    .refine((v) => v === "" || toNumber(v) !== null, `${label} geçerli bir sayı olmalı`)
    .refine((v) => v === "" || toNumber(v) === null || opts.min === undefined || (toNumber(v) as number) >= opts.min, `${label} en az ${opts.min} olmalı`)
    .refine((v) => v === "" || toNumber(v) === null || opts.max === undefined || (toNumber(v) as number) <= opts.max, `${label} en fazla ${opts.max} olabilir`);

const email = z
  .string()
  .trim()
  .max(120, "E-posta çok uzun")
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Geçerli bir e-posta adresi girin");

const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[0-9\s()-]{7,20}$/.test(v), "Geçerli bir telefon numarası girin (örn. 0532 123 45 67)");

const year = (label = "Yıl") => decimal(label, { required: true, min: 2000, max: 2100 }).refine((v) => Number.isInteger(toNumber(v)), `${label} tam sayı olmalı`);
const month = decimal("Ay", { required: true, min: 1, max: 12 });

const username = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || /^[a-z0-9][a-z0-9._-]{2,31}$/.test(v), "3-32 karakter; küçük harf, rakam, nokta, tire veya alt çizgi kullanın");

const newPassword = (required: boolean) =>
  z
    .string()
    .refine((v) => (required ? v !== "" : true), "Parola zorunlu")
    .refine((v) => v === "" || v.length >= 8, "Parola en az 8 karakter olmalı")
    .refine((v) => v.length <= 72, "Parola en fazla 72 karakter olabilir");

/* ---------------------------------- schemas ---------------------------------- */
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Kullanıcı adınızı girin"),
  password: z.string().min(1, "Parolanızı girin"),
});

export const organizationSchema = z.object({
  name: str("Firma adı", 120),
  legal_name: opt("Ticari unvan", 200),
  tax_office: str("Vergi dairesi", 80),
  tax_no: z
    .string()
    .trim()
    .min(1, "Vergi no zorunlu")
    .refine((v) => isTaxNo(v), "Vergi no 10 haneli (veya geçerli TC kimlik no) olmalı"),
  email,
  phone: z
    .string()
    .trim()
    .min(1, "Telefon zorunlu")
    .refine((v) => /^\+?[0-9\s()-]{7,20}$/.test(v), "Geçerli bir telefon numarası girin (örn. 0532 123 45 67)"),
  address: str("Adres", 300),
});

export const organizationUpdateSchema = organizationSchema.extend({ id: uuid("Firma") });

export const projectCreateSchema = z
  .object({
    organization_id: uuid("Firma"),
    service_line: str("Hizmet alanı", 40),
    name: str("Proje adı", 120),
    code: opt("Proje kodu", 40),
    address: opt("Adres", 300),
    start_date: date("Başlangıç"),
    end_date: date("Bitiş"),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "Bitiş tarihi başlangıçtan önce olamaz",
  });

export const projectUpdateSchema = z
  .object({
    id: uuid("Proje"),
    name: str("Proje adı", 120),
    code: opt("Proje kodu", 40),
    status: z.enum(["active", "paused", "closed"], "Durum seçin"),
    address: opt("Adres", 300),
    start_date: date("Başlangıç"),
    end_date: date("Bitiş"),
    notes: opt("Notlar", 2000),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "Bitiş tarihi başlangıçtan önce olamaz",
  });

export const personnelSchema = z.object({
  first_name: str("Ad", 60),
  last_name: str("Soyad", 60),
  employee_no: opt("Sicil no", 30),
  title: opt("Ünvan", 80),
  service_line: opt("Hizmet alanı", 40),
  /** Personelin kadrosunda olduğu (işveren) müşteri firma; boşsa ilk atandığı projenin firması */
  organization_id: z.string(),
  hire_date: date("İşe giriş"),
  phone,
  email,
  national_id: z.string().trim().refine((v) => v === "" || isValidTckn(v), "Geçerli bir 11 haneli TC kimlik no girin"),
  iban: z.string().trim().refine((v) => v === "" || isValidIban(v), "Geçerli bir IBAN girin (TR ile başlayan 26 karakter)"),
});

export const assignSchema = z.object({
  project_id: uuid("Proje"),
  personnel_id: uuid("Personel"),
  position: opt("Görev", 80),
  start_date: date("Başlangıç"),
});

export const timesheetSchema = z.object({
  project_id: uuid("Proje"),
  personnel_id: uuid("Personel"),
  period_year: year(),
  period_month: month,
  worked_days: decimal("Çalışılan gün", { min: 0, max: 31 }),
  leave_days: decimal("İzin", { min: 0, max: 31 }),
  absence_days: decimal("Devamsızlık", { min: 0, max: 31 }),
  overtime_hours: decimal("Fazla mesai", { min: 0, max: 400 }),
  note: opt("Not", 300),
});

export const leaveSchema = z.object({
  project_id: uuid("Proje"),
  personnel_id: uuid("Personel"),
  year: year(),
  entitled_days: decimal("Hak edilen", { min: 0, max: 60 }),
  carried_days: decimal("Devreden", { min: 0, max: 60 }),
  used_days: decimal("Kullanılan", { min: 0, max: 120 }),
});

export const threadSchema = z.object({
  project_id: uuid("Proje"),
  subject: str("Konu", 140),
  body: str("Mesaj", 5000),
});

export const messageSchema = z.object({
  thread_id: uuid("Konu"),
  body: str("Mesaj", 5000),
});

export const customerUserSchema = z
  .object({
    full_name: str("Ad soyad", 100),
    username,
    phone,
    password: newPassword(false),
    organization_id: z.string().min(1, "Firma seçin"),
    project_ids: z.array(z.string()),
    role_id: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.project_ids.length && !v.role_id) ctx.addIssue({ code: "custom", path: ["role_id"], message: "Yetki düzeyi seçin" });
  });

export const staffUserSchema = z.object({
  full_name: str("Ad soyad", 100),
  username,
  phone,
  password: newPassword(false),
  staff_role_id: z.string().min(1, "Merkez rolü seçin"),
});

export const personnelUpdateSchema = personnelSchema.extend({
  id: uuid("Personel"),
  status: z.enum(["active", "passive", "terminated"], "Durum seçin"),
});

const leaveTypes = ["yillik", "ucretsiz", "raporlu", "mazeret", "evlilik", "dogum", "olum", "diger"] as const;
export const leaveRecordSchema = z
  .object({
    assignment: z.string().min(1, "Personel seçin"), // "personelId|projeId"
    leave_type: z.enum(leaveTypes, "Kategori seçin"),
    start_date: date("İzin başlangıç tarihi", true),
    end_date: date("İzin son tarihi", true),
    return_date: date("İşe başlama tarihi", true),
    days: decimal("Toplam izin süresi", { required: true, min: 0.5, max: 365 }),
    note: opt("Not", 300),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { path: ["end_date"], message: "Son tarih, başlangıçtan önce olamaz" })
  .refine((v) => !v.end_date || !v.return_date || v.return_date > v.end_date, { path: ["return_date"], message: "İşe başlama tarihi, izin son tarihinden sonra olmalı" });

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Parola en az 8 karakter olmalı").max(72, "Parola en fazla 72 karakter olabilir"),
    confirm: z.string().min(1, "Parolayı tekrar girin"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Parolalar eşleşmiyor" });

export const resetPasswordSchema = z.object({ id: uuid("Kullanıcı"), password: newPassword(false) });
export const staffRoleSchema = z.object({ id: uuid("Kullanıcı"), staff_role_id: uuid("Rol") });
export const membershipSchema = z.object({ user_id: uuid("Kullanıcı"), project_id: uuid("Proje"), role_id: uuid("Rol") });

export const documentSchema = z
  .object({
    project_id: uuid("Proje"),
    category_code: str("Kategori", 40),
    title: str("Başlık", 140),
    personnel_id: z.string(),
    period_month: z.string(),
    period_year: z.string(),
    description: opt("Açıklama", 500),
    customer_visible: z.boolean(),
    storage_path: z.string().min(1, "Önce bir dosya yükleyin"),
    file_name: z.string(),
    mime_type: z.string(),
    size_bytes: z.string(),
    /** Yalnızca "denetim" kategorisinde: denetimin yapıldığı gün ve vardiya */
    inspection_date: z.string(),
    inspection_shift: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.category_code !== "denetim") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.inspection_date)) ctx.addIssue({ code: "custom", path: ["inspection_date"], message: "Denetim tarihini girin" });
    if (!["gece", "gunduz"].includes(v.inspection_shift)) ctx.addIssue({ code: "custom", path: ["inspection_shift"], message: "Gece veya gündüz seçin" });
  });

export const formTemplateSchema = z.object({
  title: str("Başlık", 140),
  description: opt("Açıklama", 300),
  storage_path: z.string().min(1, "Önce bir dosya yükleyin"),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.string(),
});

export const patrolPointSchema = z.object({
  project_id: uuid("Proje"),
  name: str("Nokta adı", 80).refine((v) => v.length >= 2, "Nokta adı en az 2 karakter olmalı"),
});

export const importSchema = z.object({
  project_id: uuid("Proje"),
  type: z.enum(["timesheet", "leave", "personnel"], "İçe aktarma türünü seçin"),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type OrganizationValues = z.infer<typeof organizationSchema>;
export type ProjectCreateValues = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateValues = z.infer<typeof projectUpdateSchema>;
export type PersonnelValues = z.infer<typeof personnelSchema>;
export type AssignValues = z.infer<typeof assignSchema>;
export type TimesheetValues = z.infer<typeof timesheetSchema>;
export type LeaveValues = z.infer<typeof leaveSchema>;
export type ThreadValues = z.infer<typeof threadSchema>;
export type MessageValues = z.infer<typeof messageSchema>;
export type CustomerUserValues = z.infer<typeof customerUserSchema>;
export type StaffUserValues = z.infer<typeof staffUserSchema>;
export type OrganizationUpdateValues = z.infer<typeof organizationUpdateSchema>;
export type PersonnelUpdateValues = z.infer<typeof personnelUpdateSchema>;
export type LeaveRecordValues = z.infer<typeof leaveRecordSchema>;
export const LEAVE_TYPES = leaveTypes;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type StaffRoleValues = z.infer<typeof staffRoleSchema>;
export type MembershipValues = z.infer<typeof membershipSchema>;
export type DocumentValues = z.infer<typeof documentSchema>;
export type FormTemplateValues = z.infer<typeof formTemplateSchema>;
export type PatrolPointValues = z.infer<typeof patrolPointSchema>;
