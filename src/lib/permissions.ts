/**
 * Yetki alanları (rol düzenleme ve kişiye özel yetki ekranlarında gruplama). Yetkilerin kendisi veritabanındaki
 * `permissions` tablosundadır; burada yalnızca alanların adı, sırası ve kısa açıklaması tutulur.
 */
export const PERMISSION_GROUPS: { module: string; label: string; hint: string }[] = [
  { module: "projeler", label: "Projeler", hint: "Proje bilgileri" },
  { module: "personel", label: "Personel ve izin", hint: "Personel, özlük, bordro, puantaj, izin, eğitim, kıyafet, savunma" },
  { module: "belgeler", label: "Belgeler", hint: "Genel belgeler, denetim, risk analizi, formlar" },
  { module: "finans", label: "Finans ve cari hesap", hint: "Faturalar, tahsilatlar, cari hesap" },
  { module: "devriye", label: "Devriye", hint: "Devriye kayıtları, noktalar ve etiketler" },
  { module: "iletisim", label: "Mesajlar", hint: "Merkez ile müşteri arasındaki yazışmalar" },
  { module: "yonetim", label: "Yönetim", hint: "Firmalar, kullanıcılar, işlem geçmişi, içe aktarma (yalnızca merkez)" },
];

export const moduleLabel: Record<string, string> = Object.fromEntries(PERMISSION_GROUPS.map((g) => [g.module, g.label]));

export type PermissionRow = { code: string; module: string; description: string; sort_order: number; customer_grantable: boolean };

/** "….manage" = değiştirme yetkisi; diğerleri görme yetkisidir. */
export const isManagePermission = (code: string) => code.endsWith(".manage");

export type RoleScope = "staff" | "customer";
export const SCOPE_LABEL: Record<RoleScope, string> = { staff: "Merkez rolü", customer: "Müşteri rolü" };
export const SCOPE_PATH: Record<RoleScope, string> = { staff: "/merkez/yetkiler/merkez-rolleri", customer: "/merkez/yetkiler/musteri-rolleri" };
