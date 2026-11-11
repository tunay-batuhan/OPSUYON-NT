/**
 * personnel tablosunda herkesin (yetkisi kadar) okuyabildiği İŞ BİLGİSİ sütunları. Kişisel bilgiler (telefon, e-posta,
 * doğum tarihi/yeri, memleket, adres, medeni hal, boy/kilo, beden ölçüleri, yakını, notlar) tablodan OKUNAMAZ;
 * yalnızca `personnel_personal` görünümünden ve "personelin kişisel bilgilerini gör" yetkisiyle gelir
 * (müşteri hesaplarına verilemez). Bkz. migration 20261111000800 / 000900.
 */
export const PERSONNEL_BASE_COLUMNS =
  "id, employee_no, first_name, last_name, full_name, title, service_line, hire_date, termination_date, status, organization_id, created_at, updated_at";

export const PERSONNEL_PERSONAL_COLUMNS =
  "personnel_id, phone, email, birth_date, birth_place, hometown, address, marital_status, height_cm, weight_kg, pants_size, shirt_size, coat_size, shoe_size, emergency_phone, emergency_contact_name, notes, metadata";

/** Kişisel bilgileri görme yetkisi yoksa (ya da satır yoksa) alanlar boş kalır. */
export const EMPTY_PERSONAL = {
  phone: null, email: null, birth_date: null, birth_place: null, hometown: null, address: null, marital_status: null,
  height_cm: null, weight_kg: null, pants_size: null, shirt_size: null, coat_size: null, shoe_size: null,
  emergency_phone: null, emergency_contact_name: null, notes: null, metadata: {},
} as const;
