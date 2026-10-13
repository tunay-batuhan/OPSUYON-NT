// Import definitions: which Excel columns each import type understands.
// Header matching is tolerant (Turkish characters, case, spacing, synonyms),
// so customers' own sheets usually work without renaming columns.

export type ImportType = "timesheet" | "leave" | "personnel";

export type ColumnDef = {
  key: string;
  label: string;          // header written into the template
  aliases: string[];      // accepted alternative headers (already human readable)
  required?: boolean;
  example: string;
  note?: string;
};

export type ImportDef = {
  type: ImportType;
  title: string;
  description: string;
  permission: string;     // underlying write permission
  usesPeriod: "month-year" | "year" | null; // global fallback period fields in the UI
  columns: ColumnDef[];
};

export const IMPORT_DEFS: Record<ImportType, ImportDef> = {
  timesheet: {
    type: "timesheet",
    title: "Puantaj",
    description: "Aylık puantajı personel bazında içe aktarır. Aynı personel + dönem varsa güncellenir.",
    permission: "timesheets.manage",
    usesPeriod: "month-year",
    columns: [
      { key: "employee_no", label: "Sicil No", aliases: ["sicil", "sicil numarası", "personel no", "personel sicil no"], example: "1001", note: "Sicil no veya Ad Soyad'dan en az biri zorunlu" },
      { key: "full_name", label: "Ad Soyad", aliases: ["adı soyadı", "ad soyadı", "personel", "personel adı", "isim"], example: "Ayşe Yılmaz" },
      { key: "year", label: "Yıl", aliases: ["dönem yılı"], example: "2026", note: "Boşsa ekrandaki dönem kullanılır" },
      { key: "month", label: "Ay", aliases: ["dönem ayı", "ay no"], example: "9", note: "1-12 veya ay adı" },
      { key: "worked_days", label: "Çalışılan Gün", aliases: ["çalışılan gün sayısı", "çalışma günü", "çalıştığı gün", "gün", "puantaj günü"], example: "22" },
      { key: "leave_days", label: "İzin", aliases: ["izin günü", "izinli gün", "izin gün"], example: "0" },
      { key: "absence_days", label: "Devamsızlık", aliases: ["devamsızlık günü", "devamsız gün", "mazeretsiz"], example: "0" },
      { key: "overtime_hours", label: "Fazla Mesai (sa)", aliases: ["fazla mesai", "mesai", "fazla mesai saati", "fm"], example: "8" },
      { key: "note", label: "Not", aliases: ["açıklama", "notlar"], example: "" },
    ],
  },
  leave: {
    type: "leave",
    title: "Yıllık izin bakiyesi",
    description: "Personelin yıllık izin hak / kullanım bakiyesini içe aktarır. Aynı personel + yıl varsa güncellenir.",
    permission: "leaves.manage",
    usesPeriod: "year",
    columns: [
      { key: "employee_no", label: "Sicil No", aliases: ["sicil", "sicil numarası", "personel no"], example: "1001", note: "Sicil no veya Ad Soyad'dan en az biri zorunlu" },
      { key: "full_name", label: "Ad Soyad", aliases: ["adı soyadı", "ad soyadı", "personel", "isim"], example: "Ayşe Yılmaz" },
      { key: "year", label: "Yıl", aliases: ["izin yılı"], example: "2026", note: "Boşsa ekrandaki yıl kullanılır" },
      { key: "entitled_days", label: "Hak Edilen", aliases: ["hak edilen izin", "yıllık izin hakkı", "hak", "toplam hak"], example: "14" },
      { key: "carried_days", label: "Devreden", aliases: ["devreden izin", "önceki yıldan devir", "devir"], example: "0" },
      { key: "used_days", label: "Kullanılan", aliases: ["kullanılan izin", "kullanılan gün", "kullanım"], example: "4" },
    ],
  },
  personnel: {
    type: "personnel",
    title: "Personel listesi",
    description: "Personel kayıtlarını ekler / günceller ve bu projeye atar. Sicil no ile eşleşen kayıt güncellenir.",
    permission: "personnel.manage",
    usesPeriod: null,
    columns: [
      { key: "employee_no", label: "Sicil No", aliases: ["sicil", "sicil numarası", "personel no"], example: "1001", note: "Güncelleme eşleşmesi için önerilir" },
      { key: "first_name", label: "Ad", aliases: ["adı", "isim"], example: "Ayşe", required: true },
      { key: "last_name", label: "Soyad", aliases: ["soyadı"], example: "Yılmaz", required: true },
      { key: "title", label: "Ünvan", aliases: ["unvan", "pozisyon", "meslek"], example: "Güvenlik görevlisi" },
      { key: "phone", label: "Telefon", aliases: ["telefon no", "cep", "cep telefonu", "gsm"], example: "0532 000 00 00" },
      { key: "email", label: "E-posta", aliases: ["eposta", "e posta", "mail"], example: "" },
      { key: "hire_date", label: "İşe Giriş", aliases: ["işe giriş tarihi", "giriş tarihi", "işe başlama"], example: "01.03.2026", note: "GG.AA.YYYY veya YYYY-AA-GG" },
      { key: "national_id", label: "TC Kimlik No", aliases: ["tc", "tckn", "tc no", "kimlik no"], example: "", note: "Yalnızca hassas veri yetkisi olanlar" },
      { key: "iban", label: "IBAN", aliases: ["iban no"], example: "", note: "Yalnızca hassas veri yetkisi olanlar" },
      { key: "position", label: "Görev", aliases: ["projedeki görev", "görevi"], example: "Güvenlik görevlisi" },
      { key: "shift", label: "Vardiya", aliases: ["çalışma saatleri", "mesai saatleri"], example: "08:00-20:00" },
    ],
  },
};

/** Turkish-insensitive key for header matching. */
export function normKey(input: string): string {
  return input
    .replaceAll("İ", "i").replaceAll("I", "ı")
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i").replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ş", "s").replaceAll("ö", "o").replaceAll("ç", "c")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const MONTH_NAMES: Record<string, number> = Object.fromEntries(
  ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"].map((m, i) => [m, i + 1]),
);
