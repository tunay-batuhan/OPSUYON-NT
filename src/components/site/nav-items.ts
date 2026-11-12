/** Herkese açık sitenin üst menüsü (masaüstü + mobil aynı liste). */
export const SITE_NAV = [
  { href: "/#hizmetler", label: "Hizmetler" },
  { href: "/#ozellikler", label: "Özellikler" },
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/iletisim", label: "İletişim" },
] as const;

export const LEGAL_NAV = [
  { href: "/gizlilik-politikasi", label: "Gizlilik Politikası" },
  { href: "/kvkk-aydinlatma-metni", label: "KVKK Aydınlatma Metni" },
  { href: "/cerez-politikasi", label: "Çerez Politikası" },
  { href: "/kullanim-kosullari", label: "Kullanım Koşulları" },
] as const;
