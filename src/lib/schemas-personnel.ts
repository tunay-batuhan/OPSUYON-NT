// Personel kartı ve personel evrakı şemaları (5. tur). Tarayıcıda (react-hook-form) ve
// sunucuda (action içinde) AYNI şema çalışır. Sicil no arayüzden kalktı; kolon DB'de duruyor.
import { z } from "zod";
import { date, decimal, email, opt, phone, str, uuid } from "@/lib/schemas";
import { isValidIban, isValidTckn, toNumber } from "@/lib/parse";

/** Boş olabilen tam sayı (boy/kilo gibi). */
const int = (label: string, min: number, max: number) =>
  decimal(label, { min, max }).refine((v) => v === "" || Number.isInteger(toNumber(v)), `${label} tam sayı olmalı`);

const today = () => new Date().toLocaleDateString("sv-SE");

export const MARITAL_OPTIONS = [
  { value: "bekar", label: "Bekar" },
  { value: "evli", label: "Evli" },
];

const cardFields = {
  first_name: str("Ad", 60),
  last_name: str("Soyad", 60),
  title: opt("Ünvan", 80),
  service_line: opt("Hizmet alanı", 40),
  /** Personelin kadrosunda olduğu (işveren) müşteri firma; boşsa ilk atandığı projenin firması */
  organization_id: z.string(),
  hire_date: date("İşe giriş"),
  phone,
  email,
  national_id: z.string().trim().refine((v) => v === "" || isValidTckn(v), "Geçerli bir 11 haneli TC kimlik no girin"),
  iban: z.string().trim().refine((v) => v === "" || isValidIban(v), "Geçerli bir IBAN girin (TR ile başlayan 26 karakter)"),
  // kişisel bilgiler
  birth_date: date("Doğum tarihi").refine((v) => v === "" || v <= today(), "Doğum tarihi bugünden sonra olamaz"),
  birth_place: opt("Doğum yeri", 80),
  hometown: opt("Memleketi", 80),
  address: opt("Adres", 300),
  // includes(): tip daraltan (type predicate) bir kontrol olmasın; form girdisi/çıktısı string kalmalı
  marital_status: z.string().refine((v) => ["", "bekar", "evli"].includes(v), "Medeni hali seçin"),
  // beden ölçüleri (kıyafet / ekipman teslimi için)
  height_cm: int("Boy", 100, 250),
  weight_kg: int("Kilo", 30, 250),
  pants_size: opt("Pantolon ölçüsü", 10),
  shirt_size: opt("Gömlek ölçüsü", 10),
  coat_size: opt("Mont ölçüsü", 10),
  shoe_size: opt("Ayakkabı no", 10),
  // ulaşılamazsa aranacak kişi
  emergency_phone: phone,
  emergency_contact_name: opt("Yedek telefon kime ait", 80),
};

const hireAfterBirth = (v: { birth_date: string; hire_date: string }) => !v.birth_date || !v.hire_date || v.hire_date > v.birth_date;
const hireAfterBirthMsg = { path: ["hire_date"], message: "İşe giriş tarihi doğum tarihinden sonra olmalı" };

export const personnelCreateSchema = z.object(cardFields).refine(hireAfterBirth, hireAfterBirthMsg);

export const personnelEditSchema = z
  .object({
    ...cardFields,
    id: uuid("Personel"),
    status: z.enum(["active", "passive", "terminated"], "Durum seçin"),
  })
  .refine(hireAfterBirth, hireAfterBirthMsg);

/**
 * Merkez > Personel > Evrak ekle. Alan adları documentSchema ile aynıdır (registerDocument'a aynen geçer);
 * project_id formda seçilmez, personelin AKTİF atamasının projesinden gelir.
 */
export const personnelDocumentSchema = z.object({
  personnel_id: uuid("Personel"),
  project_id: z.string(),
  category_code: str("Kategori", 40),
  title: str("Başlık", 140),
  period_month: z.string(),
  period_year: z.string(),
  description: opt("Açıklama", 500),
  customer_visible: z.boolean(),
  storage_path: z.string().min(1, "Önce bir dosya yükleyin"),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.string(),
  inspection_date: z.string(),
  inspection_shift: z.string(),
});

export type PersonnelCreateValues = z.infer<typeof personnelCreateSchema>;
export type PersonnelEditValues = z.infer<typeof personnelEditSchema>;
export type PersonnelDocumentValues = z.infer<typeof personnelDocumentSchema>;
