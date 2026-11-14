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
 * Sitenin yayındaki kök adresi (sonunda / olmadan). Ortam değişkeni `SITE_URL`; yoksa Vercel'deki yedek adres.
 * Asıl sunucuda (VDS, /srv/opsuyon/shared/.env) SITE_URL=https://opsuyon.com. Vercel'de tanımsız bırakılır:
 * yedek adres arama motoruna kapalı kalır (SITE_INDEXABLE yalnızca VDS'te açık). Devriye QR etiketleri de
 * aynı değişkeni kullanır.
 */
export const SITE_URL = (process.env.SITE_URL?.trim() || "https://opsuyon-nt.vercel.app").replace(/\/+$/, "");

/**
 * Arama motorlarına açılma anahtarı. Varsayılan KAPALI: yer tutucu şirket bilgileri Google'a girmesin.
 * Kapalıyken robots.txt her şeyi kapatır ve her sayfada `noindex` vardır. Açmak: sunucunun .env dosyasında
 * SITE_INDEXABLE=true + yeniden derleme (değer derleme anında okunur). Yalnızca asıl adreste açılır.
 */
export const SITE_INDEXABLE = process.env.SITE_INDEXABLE === "true";

/**
 * Google Search Console "HTML etiketi" doğrulama kodu (yalnızca content="…" içindeki değer).
 * Ortam değişkeni `GOOGLE_SITE_VERIFICATION`; boşsa etiket basılmaz.
 */
export const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined;

/** Göreli yolu tam adrese çevirir: "/iletisim" → "https://…/iletisim". */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/* ------------------------------------------------------------------ */
/* Şirket bilgileri                                                     */
/* ------------------------------------------------------------------ */
/*
 * ZORUNLU (KVKK aydınlatma: veri sorumlusunun kimliği + başvuru yolu): unvan, adres, e-posta.
 * İSTEĞE BAĞLI: boş ("") bırakılan alan sitenin hiçbir yerinde görünmez; doldurulunca kendiliğinden çıkar.
 */
export const COMPANY = {
  /** Ticaret sicilindeki tam unvan. */
  legalName: "OPSUYON Operasyonel Yönetim ve Teknoloji Ltd. Şti.",
  /** Kısa ad (isteğe bağlı): boşsa her yerde tam unvan kullanılır. */
  shortName: "",
  address: {
    street: "Kemal Türkler Mah. Yazlık Sk. No: 3/2",
    district: "Sancaktepe",
    city: "İstanbul",
    /** isteğe bağlı */
    postalCode: "",
    /** ISO ülke kodu (JSON-LD) */
    country: "TR",
  },
  /** Genel iletişim e-postası (KVKK başvuruları da buraya). */
  email: "info@opsuyon.com",
  /* ---- isteğe bağlı ---- */
  /** Ör. "0212 123 45 67"; tel: bağlantısı buradan otomatik üretilir. */
  phone: "0216 396 21 93",
  taxOffice: "",
  taxNumber: "",
  /** 16 haneli MERSİS numarası */
  mersis: "",
  tradeRegistry: "",
  /** Kayıtlı elektronik posta adresi, ör. "ornek@hs01.kep.tr" */
  kep: "",
  /** Ör. "Hafta içi 09:00–18:00" */
  workingHours: "",
} as const;

/** İsteğe bağlı alan doldurulmuş mu (boş/yer tutucuysa gösterilmez). */
export const has = (value: string | null | undefined) => !isPlaceholder(value);

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
  /** KVKK başvurularının yapılacağı e-posta (şimdilik genel e-postayla aynı). */
  email: COMPANY.email,
  /** VERBİS kayıt numarası (kayıt yükümlülüğü varsa; boşsa gösterilmez). */
  verbis: "",
} as const;

/** Uyuşmazlıklarda yetkili yer (Kullanım Koşulları): şirket merkezinin bulunduğu il. Avukat farklı derse buraya yazılır. */
export const JURISDICTION = isPlaceholder(COMPANY.address.city)
  ? "[Şirket merkezinin bulunduğu il] Mahkemeleri ve İcra Daireleri"
  : `${COMPANY.address.city} Mahkemeleri ve İcra Daireleri`;

/** Yasal metinlerin "Son güncelleme" tarihi (YYYY-AA-GG). Metin değişince güncelleyin. */
// Yasal metinler hizmet sağlayıcı adı ve sunucu ülkesi vermez (şirket kararı, 14 Kasım 2026): yalnızca
// "sitenin sunucuları Türkiye'de, bazı sağlayıcıların sunucuları yurt dışında" denir.
export const LEGAL_UPDATED_AT = "2026-11-14";

/** Zorunlu şirket alanları doldurulmuş mu? (Doldurulmadan SITE_INDEXABLE açılmamalı.) */
export const COMPANY_COMPLETE = [
  COMPANY.legalName, COMPANY.address.street, COMPANY.address.district, COMPANY.address.city, COMPANY.email, KVKK.email,
].every((v) => !isPlaceholder(v));

/* ------------------------------------------------------------------ */
/* Türetilmiş yardımcılar                                               */
/* ------------------------------------------------------------------ */

/** Adres tek satır: doldurulmamış parçalar yer tutucu olarak kalır (sayfada işaretli görünür). */
export const addressLine = () => {
  const a = COMPANY.address;
  const cityPart = [has(a.postalCode) ? a.postalCode : "", `${a.district}/${a.city}`].filter(Boolean).join(" ");
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
