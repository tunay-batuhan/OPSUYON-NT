/**
 * Herkese açık sitenin (tanıtım sayfaları, yasal metinler, iletişim, SEO) TEK ayar dosyası.
 *
 * ŞİRKETE ÖZEL BİLGİLER HENÜZ GELMEDİ: köşeli parantezli değerler ("[Şirket Unvanı]" gibi) yer tutucudur.
 * Gerçek bilgi gelince yalnızca bu dosyadaki değerler değiştirilir; sayfalar, alt bilgi, yasal metinler ve
 * yapılandırılmış veri (JSON-LD) buradan okur. Yer tutucu değerler sayfada sarı işaretli görünür, tıklanabilir
 * bağlantıya (tel:, mailto:) dönüşmez ve JSON-LD'ye hiç yazılmaz.
 *
 * Marka metinleri (OPSÜYON, slogan) `src/lib/brand.ts` içinde kalır.
 */

/** "[...]" biçimindeki ya da boş değer henüz doldurulmamış demektir. */
export function isPlaceholder(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v === "" || /^\[.*\]$/.test(v);
}

/** Doldurulmuşsa değeri, yer tutucuysa `undefined` döner (JSON-LD ve bağlantılar için). */
export const filled = (value: string | null | undefined): string | undefined => (isPlaceholder(value) ? undefined : value!.trim());

/* ------------------------------------------------------------------ */
/* Adres ve indeksleme                                                  */
/* ------------------------------------------------------------------ */

/**
 * Sitenin yayındaki kök adresi (sonunda / olmadan). Ortam değişkeni `SITE_URL`; yoksa şu anki canlı adres.
 * Not: opsuyon.com henüz bağlanmadı. Bağlanınca Vercel'de SITE_URL=https://www.opsuyon.com (ya da hangisi
 * esas olacaksa) yazılıp yeniden yayınlanır. Devriye QR etiketleri de aynı değişkeni kullanır.
 */
export const SITE_URL = (process.env.SITE_URL?.trim() || "https://opsuyon-nt.vercel.app").replace(/\/+$/, "");

/**
 * Arama motorlarına açılma anahtarı. Varsayılan KAPALI: yer tutucu şirket bilgileri Google'a girmesin.
 * Kapalıyken robots.txt her şeyi kapatır ve her sayfada `noindex` vardır. Gerçek bilgiler girildikten sonra
 * Vercel'de SITE_INDEXABLE=true yapılıp yeniden yayınlamak TEK adımdır (değer derleme anında okunur).
 */
export const SITE_INDEXABLE = process.env.SITE_INDEXABLE === "true";

/** Göreli yolu tam adrese çevirir: "/iletisim" → "https://…/iletisim". */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/* ------------------------------------------------------------------ */
/* Şirket bilgileri — SAHİBİ DOLDURACAK                                */
/* ------------------------------------------------------------------ */
export const COMPANY = {
  /** Ticaret sicilindeki tam unvan (ör. "Örnek Tesis Yönetim Hizmetleri Anonim Şirketi"). */
  legalName: "[Şirket Unvanı]",
  /** Kısa ad (ör. "Örnek A.Ş."): metin içinde "Şirket" yerine kullanılır. */
  shortName: "[Kısa Şirket Adı]",
  address: {
    street: "[Açık Adres]",
    district: "[İlçe]",
    city: "[İl]",
    postalCode: "[Posta Kodu]",
    /** ISO ülke kodu (JSON-LD) */
    country: "TR",
  },
  /** Ekranda görünen biçim, ör. "0212 123 45 67". tel: bağlantısı buradan otomatik üretilir. */
  phone: "[Telefon]",
  /** Genel iletişim e-postası, ör. "info@opsuyon.com". */
  email: "[E-posta Adresi]",
  taxOffice: "[Vergi Dairesi]",
  taxNumber: "[Vergi Kimlik No]",
  /** 16 haneli MERSİS numarası */
  mersis: "[MERSİS No]",
  /** Ticaret sicil numarası (isteğe bağlı; boş bırakılırsa gösterilmez). */
  tradeRegistry: "",
  /** Kayıtlı elektronik posta adresi, ör. "ornek@hs01.kep.tr" */
  kep: "[KEP Adresi]",
  /** Ör. "Hafta içi 09:00–18:00" */
  workingHours: "[Çalışma Saatleri]",
} as const;

/** Sosyal medya: boş olanlar hiçbir yerde gösterilmez. Tam adres yazılır (https://…). */
export const SOCIAL: { label: string; url: string }[] = [
  { label: "LinkedIn", url: "" },
  { label: "Instagram", url: "" },
  { label: "X (Twitter)", url: "" },
  { label: "YouTube", url: "" },
  { label: "Facebook", url: "" },
];
export const activeSocial = () => SOCIAL.filter((s) => !isPlaceholder(s.url));

/** KVKK (6698) veri sorumlusu başvuru kanalları. */
export const KVKK = {
  /** KVKK başvurularının yapılacağı e-posta (genel e-postadan farklı olabilir, ör. "kvkk@opsuyon.com"). */
  email: "[KVKK Başvuru E-postası]",
  /** VERBİS kayıt numarası (kayıt yükümlülüğü varsa; boşsa gösterilmez). */
  verbis: "",
} as const;

/** Uyuşmazlıklarda yetkili yer (Kullanım Koşulları). Avukatla belirlenmeli. */
export const JURISDICTION = "[Yetkili Mahkeme ve İcra Daireleri, ör. İstanbul (Çağlayan)]";

/** Yasal metinlerin "Son güncelleme" tarihi (YYYY-AA-GG). Metin değişince güncelleyin. */
export const LEGAL_UPDATED_AT = "2026-11-12";

/** Tüm zorunlu şirket alanları doldurulmuş mu? (Doldurulmadan SITE_INDEXABLE açılmamalı.) */
export const COMPANY_COMPLETE = [
  COMPANY.legalName, COMPANY.shortName, COMPANY.address.street, COMPANY.address.district, COMPANY.address.city,
  COMPANY.phone, COMPANY.email, COMPANY.taxOffice, COMPANY.taxNumber, COMPANY.mersis, COMPANY.kep, KVKK.email,
].every((v) => !isPlaceholder(v));

/* ------------------------------------------------------------------ */
/* Türetilmiş yardımcılar                                               */
/* ------------------------------------------------------------------ */

/** Adres tek satır: doldurulmamış parçalar yer tutucu olarak kalır (sayfada işaretli görünür). */
export const addressLine = () => {
  const a = COMPANY.address;
  const cityPart = [a.postalCode, `${a.district}/${a.city}`].join(" ");
  return `${a.street}, ${cityPart}`;
};
export const addressFilled = () => [COMPANY.address.street, COMPANY.address.district, COMPANY.address.city].every((v) => !isPlaceholder(v));

/** "0212 123 45 67" → "tel:+902121234567". Telefon doldurulmadıysa undefined. */
export function telHref(phone: string = COMPANY.phone): string | undefined {
  if (isPlaceholder(phone)) return undefined;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("90") || digits.length === 10) digits = `90${digits}`;
  return `tel:+${digits}`;
}

/** E-posta doldurulduysa mailto: bağlantısı. */
export const mailHref = (email: string = COMPANY.email, subject?: string) =>
  isPlaceholder(email) ? undefined : `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

/** Kısa ad yoksa unvan, o da yoksa yer tutucu: metin içinde "Şirket" yerine. */
export const companyName = () => (isPlaceholder(COMPANY.shortName) ? COMPANY.legalName : COMPANY.shortName);
