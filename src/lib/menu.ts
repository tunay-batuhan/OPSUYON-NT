import { canAnywhere, type CurrentUser } from "@/lib/auth";
import type { NavChild, NavItem } from "@/components/nav";

type Def = NavItem & { anyOf?: string[]; staffOnly?: boolean };

/**
 * Alt sayfalar sol menüde açılır liste değil, sayfanın üstünde SEKME olarak görünür (Tunay, 6 Kasım).
 * Sol menüdeki öğe ilk sekmeye gider; sekmeleri <SectionTabs section="..."> çizer (aynı tanımlar).
 */
export type Section = "personel" | "devriye" | "cari";

export function sectionPages(section: Section, user: CurrentUser, on: Set<string>): NavChild[] {
  const can = (perm: string) => canAnywhere(user, perm);
  const customer = user.kind === "customer";
  if (section === "personel") {
    if (!customer) return [];
    const pages: (NavChild & { ok: boolean })[] = [
      { href: "/personel", label: "Tüm Personel", exact: true, ok: can("personnel.read") },
      // Özlük Evrakları: iş sözleşmeleri de burada (Personel Sözleşmeleri sekmesi kalktı)
      { href: "/personel/ozluk", label: "Özlük Evrakları", ok: on.has("personel_ozluk") && (can("personnel.files.read") || can("contracts.read")) },
      { href: "/personel/izinler", label: "Yıllık İzinler", ok: on.has("personel_izin") && can("leaves.read") },
      { href: "/personel/kiyafet", label: "Kıyafet ve Ekipman", ok: on.has("personel_kiyafet") && can("uniform.read") },
    ];
    return pages.filter((p) => p.ok).map(({ href, label, exact }) => ({ href, label, exact }));
  }
  if (section === "devriye") {
    if (customer && !on.has("devriye")) return [];
    const pages: (NavChild & { ok: boolean })[] = [
      { href: "/devriye/rapor", label: "Devriye Kayıtları", ok: can("patrol.read") },
      { href: "/devriye/noktalar", label: "Noktalar ve Etiketler", exact: true, ok: !customer && can("patrol.manage") },
      { href: "/devriye/noktalar/ekle", label: "Yeni nokta ekle", ok: !customer && can("patrol.manage") },
      { href: "/devriye/pinler", label: "Proje PIN'leri", ok: !customer && can("patrol.manage") },
    ];
    return pages.filter((p) => p.ok).map(({ href, label, exact }) => ({ href, label, exact }));
  }
  // cari: müşteri tarafı (merkezde Faturalar ve Cari Hesap ayrı menülerdir)
  if (!customer) return [];
  const pages: (NavChild & { ok: boolean })[] = [
    { href: "/cari-hesap", label: "Cari Ekstre", exact: true, ok: on.has("cari_hesap") && can("ledger.read") },
    { href: "/cari-hesap/faturalar", label: "Faturalar", ok: on.has("cari_faturalar") && can("invoices.read") },
  ];
  return pages.filter((p) => p.ok).map(({ href, label, exact }) => ({ href, label, exact }));
}

/**
 * Müşteri menüsü, müşterinin yazılı isteğine göre (docs/yol-haritasi.md):
 *   Ana Sayfa · Personel · Eğitimler · Bordrolar · Savunmalar ve İhtarlar · Formlar · Puantaj · Denetimler · Devriye Sistemi · Risk Analizi · Cari Hesap   (alt sayfalar sayfada sekme)
 * Her öğe bir "modül"dür; kapalı modüller menüde görünmez (Merkez → Müşteri modülleri).
 */
function customerMenu(user: CurrentUser, on: Set<string>): NavItem[] {
  const can = (perm: string) => canAnywhere(user, perm);
  const items: NavItem[] = [{ href: "/panel", label: "Ana Sayfa", icon: "home", exact: true }];

  if (on.has("projeler") && can("projects.read")) items.push({ href: "/projeler", label: "Projeler", icon: "projects", match: ["/projeler"] });

  // Personel: Tüm Personel / Özlük Evrakları / Yıllık İzinler / Kıyafet sayfanın üstünde sekme
  const personnel = sectionPages("personel", user, on);
  if (personnel.length) items.push({ href: personnel[0].href, label: "Personel", icon: "personnel", match: ["/personel"] });

  // Eğitimler, Bordrolar, Savunmalar ve İhtarlar: Personel altında değil, üst menüde ayrı sekmeler
  if (on.has("personel_egitim") && can("trainings.read")) items.push({ href: "/egitimler", label: "Eğitimler", icon: "training" });
  if (on.has("personel_bordro") && can("payroll.read")) items.push({ href: "/bordrolar", label: "Bordrolar", icon: "payroll" });
  if (on.has("personel_savunma") && can("defenses.read")) items.push({ href: "/savunmalar", label: "Savunmalar ve İhtarlar", icon: "defense" });

  if (on.has("formlar") && can("forms.read")) items.push({ href: "/formlar", label: "Formlar", icon: "forms" });

  if (on.has("puantaj") && can("timesheets.read")) items.push({ href: "/puantaj", label: "Puantaj", icon: "timesheets" });
  if (on.has("izin_yonetimi") && can("leaves.read")) items.push({ href: "/izinler", label: "İzin Yönetimi", icon: "leaves" });
  if (on.has("denetimler") && can("inspections.read")) items.push({ href: "/denetimler", label: "Denetimler", icon: "inspections" });
  const patrol = sectionPages("devriye", user, on);
  if (patrol.length) items.push({ href: patrol[0].href, label: "Devriye Sistemi", icon: "patrol", badge: "Demo", match: ["/devriye"] });

  if (on.has("risk_analizi") && can("risk.read")) items.push({ href: "/risk-analizi", label: "Risk Analizi", icon: "risk" });

  const cari = sectionPages("cari", user, on);
  if (cari.length) items.push({ href: cari[0].href, label: "Cari Hesap", icon: "ledger", match: ["/cari-hesap"] });

  if (on.has("raporlar") && can("reports.read")) items.push({ href: "/raporlar", label: "Raporlar", icon: "reports" });
  if (on.has("mesajlar") && (can("messages.use") || can("messages.manage"))) items.push({ href: "/mesajlar", label: "Mesajlar", icon: "messages" });
  return items;
}

/** Merkez menüsü: yönetim ekranları (müşterinin göreceği belgeleri merkez yükler). */
function staffMenu(user: CurrentUser): NavItem[] {
  const defs: Def[] = [
    { href: "/merkez", label: "Ana Sayfa", icon: "home", exact: true },
    { href: "/projeler", label: "Projeler", icon: "projects", anyOf: ["projects.read"], match: ["/projeler", "/merkez/projeler"] },
    { href: "/personel", label: "Personel", icon: "personnel", anyOf: ["personnel.read"], match: ["/personel", "/merkez/personel"] },
    { href: "/puantaj", label: "Puantaj", icon: "timesheets", anyOf: ["timesheets.read"] },
    { href: "/izinler", label: "İzin Yönetimi", icon: "leaves", anyOf: ["leaves.read"] },
    { href: "/bordrolar", label: "Bordrolar", icon: "payroll", anyOf: ["payroll.read"] },
    { href: "/formlar", label: "Formlar", icon: "forms", anyOf: ["forms.read"] },
    { href: "/denetimler", label: "Denetimler", icon: "inspections", anyOf: ["inspections.read"] },
    { href: "/devriye/rapor", label: "Devriye Sistemi", icon: "patrol", badge: "Demo", anyOf: ["patrol.read", "patrol.manage"], match: ["/devriye"] },
    { href: "/risk-analizi", label: "Risk Analizi", icon: "risk", anyOf: ["risk.read"] },
    { href: "/faturalar", label: "Faturalar", icon: "invoices", anyOf: ["invoices.read"] },
    { href: "/cari-hesap", label: "Cari Hesap", icon: "ledger", anyOf: ["ledger.read"], match: ["/cari-hesap"] },
    { href: "/raporlar", label: "Raporlar", icon: "reports", anyOf: ["reports.read"] },
    { href: "/mesajlar", label: "Mesajlar", icon: "messages", anyOf: ["messages.use", "messages.manage"] },
    { href: "/merkez/firmalar", label: "Firmalar", icon: "organizations", anyOf: ["organizations.read"], group: "Yönetim" },
    { href: "/merkez/kullanicilar", label: "Kullanıcılar & hesaplar", icon: "users", anyOf: ["users.read"], group: "Yönetim" },
    { href: "/merkez/moduller", label: "Müşteri modülleri", icon: "modules", anyOf: ["access.manage"], group: "Yönetim" },
    { href: "/merkez/islem-gecmisi", label: "İşlem geçmişi", icon: "audit", anyOf: ["audit.read"], group: "Yönetim" },
  ];
  return defs
    .filter((d) => !d.anyOf || d.anyOf.some((p) => canAnywhere(user, p)))
    .map((d) => {
      // Devriye alt sayfaları (Rapor, Noktalar, Yeni nokta) sayfada sekme; menüdeki öğe ilk sekmeye gider
      const href = d.icon === "patrol" ? (sectionPages("devriye", user, new Set())[0]?.href ?? d.href) : d.href;
      return { href, label: d.label, icon: d.icon, exact: d.exact, group: d.group, match: d.match, badge: d.badge };
    });
}

export function menuFor(user: CurrentUser, enabledModules: Set<string>): NavItem[] {
  return user.kind === "customer" ? customerMenu(user, enabledModules) : staffMenu(user);
}
