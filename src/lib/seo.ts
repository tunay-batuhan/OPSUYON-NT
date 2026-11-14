import type { Metadata } from "next";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";
import { COMPANY, KVKK, LEGAL_UPDATED_AT, SITE_URL, absoluteUrl, activeSocial, filled } from "@/lib/site";

/** Tanıtım sayfalarının içeriği en son ne zaman değişti (site haritası `lastmod`). İçerik değişince güncelleyin. */
const CONTENT_UPDATED_AT = "2026-11-14";

/** Herkese açık, arama motoruna açılabilecek sayfalar (site haritası buradan üretilir). */
export const PUBLIC_PAGES: { path: string; name: string; updated: string; priority: number; changeFrequency: "monthly" | "yearly" }[] = [
  { path: "/", name: "Ana sayfa", updated: CONTENT_UPDATED_AT, priority: 1, changeFrequency: "monthly" },
  { path: "/hakkimizda", name: "Hakkımızda", updated: CONTENT_UPDATED_AT, priority: 0.7, changeFrequency: "yearly" },
  { path: "/iletisim", name: "İletişim", updated: CONTENT_UPDATED_AT, priority: 0.8, changeFrequency: "yearly" },
  { path: "/gizlilik-politikasi", name: "Gizlilik Politikası", updated: LEGAL_UPDATED_AT, priority: 0.3, changeFrequency: "yearly" },
  { path: "/kvkk-aydinlatma-metni", name: "KVKK Aydınlatma Metni", updated: LEGAL_UPDATED_AT, priority: 0.3, changeFrequency: "yearly" },
  { path: "/cerez-politikasi", name: "Çerez Politikası", updated: LEGAL_UPDATED_AT, priority: 0.3, changeFrequency: "yearly" },
  { path: "/kullanim-kosullari", name: "Kullanım Koşulları", updated: LEGAL_UPDATED_AT, priority: 0.3, changeFrequency: "yearly" },
];

/**
 * Giriş arkasındaki yollar (src/app/(app) altındaki üst klasörler) + devriye QR sayfaları + API.
 * robots.txt bunları kapatır. /giris kapatılmaz: sayfa kendi `noindex` etiketini taşır ve tarayıcının onu
 * görebilmesi gerekir. Yeni bir giriş arkası klasör eklenirse buraya da eklenmeli.
 */
export const PRIVATE_PATHS = [
  "/api/", "/d/", "/ara", "/bildirimler", "/bordrolar", "/cari-hesap", "/denetimler", "/devriye", "/egitimler", "/faturalar",
  "/formlar", "/izinler", "/merkez", "/mesajlar", "/panel", "/personel", "/profil", "/projeler", "/puantaj", "/risk-analizi",
  "/savunmalar", "/sozlesmeler", "/vardiya",
];

/**
 * Herkese açık sayfaların meta verisi. Next.js meta verileri SIĞ birleştirir: sayfa `openGraph` verirse
 * düzenin `openGraph`'ı tamamen değişir. Bu yüzden her sayfa tam seti buradan alır.
 * `robots` burada verilmez: kök düzen (SITE_INDEXABLE) belirler.
 * Paylaşım görseli: /og-image.png (src/app/og-image.png/route.tsx).
 */
const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: `${BRAND} — ${BRAND_TAGLINE}`, type: "image/png" };

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  /** "/" ile başlayan kanonik yol */
  path: string;
  /** true: başlık şablonu ("… · OPSÜYON") uygulanmaz */
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${BRAND}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      siteName: BRAND,
      url: path,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [OG_IMAGE.url] },
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD (schema.org). Yer tutucu alanlar hiç yazılmaz.               */
/* ------------------------------------------------------------------ */
type Ld = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

/** undefined / boş dizi / boş nesne alanlarını atar. */
function clean<T extends Ld>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0) && !(v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)),
  ) as T;
}

export function organizationLd(): Ld {
  const a = COMPANY.address;
  const address = clean({
    "@type": "PostalAddress",
    streetAddress: filled(a.street),
    addressLocality: filled(a.district),
    addressRegion: filled(a.city),
    postalCode: filled(a.postalCode),
    addressCountry: filled(a.street) || filled(a.city) ? a.country : undefined,
  });
  const phone = filled(COMPANY.phone);
  const email = filled(COMPANY.email);
  return clean({
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND,
    legalName: filled(COMPANY.legalName),
    alternateName: filled(COMPANY.shortName),
    description: `${BRAND} — ${BRAND_TAGLINE}`,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon-512.png"),
    email,
    telephone: phone,
    taxID: filled(COMPANY.taxNumber),
    address: Object.keys(address).length > 1 ? address : undefined,
    sameAs: activeSocial().map((s) => s.url),
    contactPoint:
      phone || email
        ? [clean({ "@type": "ContactPoint", contactType: "customer service", telephone: phone, email, areaServed: "TR", availableLanguage: ["Turkish"] })]
        : undefined,
  });
}

export function websiteLd(): Ld {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: BRAND,
    url: absoluteUrl("/"),
    inLanguage: "tr-TR",
    publisher: { "@id": ORG_ID },
  };
}

/** Ana sayfa → … → bu sayfa */
export function breadcrumbLd(trail: { name: string; path: string }[]): Ld {
  const items = [{ name: "Ana sayfa", path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function faqLd(items: { q: string; a: string }[]): Ld {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Bir sayfanın JSON-LD grafiği; `<script type="application/ld+json">` içine güvenli biçimde yazılır. */
export function ldJson(...nodes: Ld[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}

/** KVKK başvuru adresi yoksa genel e-posta. */
export const kvkkEmail = () => filled(KVKK.email) ?? filled(COMPANY.email);
