import { canAnywhere, type CurrentUser } from "@/lib/auth";
import type { NavChild, NavItem } from "@/components/nav";

type Def = NavItem & { anyOf?: string[]; staffOnly?: boolean };

/**
 * Müşteri menüsü, müşterinin yazılı isteğine göre (docs/yol-haritasi.md):
 *   Ana Sayfa · Personel ▾ (Özlük Evrakları, Yıllık İzinler, Kıyafet) · Eğitimler · Bordrolar · Savunmalar ve İhtarlar · Formlar · Puantaj · Denetimler · Devriye Sistemi ▾ · Risk Analizi · Cari Hesap ▾
 * Her öğe bir "modül"dür; kapalı modüller menüde görünmez (Merkez → Müşteri modülleri).
 */
function customerMenu(user: CurrentUser, on: Set<string>): NavItem[] {
  const can = (perm: string) => canAnywhere(user, perm);
  const items: NavItem[] = [{ href: "/panel", label: "Ana Sayfa", icon: "home", exact: true }];

  if (on.has("projeler") && can("projects.read")) items.push({ href: "/projeler", label: "Projeler", icon: "projects", match: ["/projeler"] });

  // Özlük Evrakları: iş sözleşmeleri de burada (Personel Sözleşmeleri sekmesi kalktı)
  const personnel: (NavChild & { mod: string; perms: string[] })[] = [
    { href: "/personel/ozluk", label: "Özlük Evrakları", mod: "personel_ozluk", perms: ["personnel.files.read", "contracts.read"] },
    { href: "/personel/izinler", label: "Yıllık İzinler", mod: "personel_izin", perms: ["leaves.read"] },
    { href: "/personel/kiyafet", label: "Kıyafet ve Ekipman", mod: "personel_kiyafet", perms: ["uniform.read"] },
  ];
  const personnelChildren = personnel.filter((c) => on.has(c.mod) && c.perms.some(can)).map(({ href, label }) => ({ href, label }));
  if (personnelChildren.length) items.push({ href: personnelChildren[0].href, label: "Personel", icon: "personnel", match: ["/personel"], children: personnelChildren });

  // Eğitimler, Bordrolar, Savunmalar ve İhtarlar: Personel altında değil, üst menüde ayrı sekmeler
  if (on.has("personel_egitim") && can("trainings.read")) items.push({ href: "/egitimler", label: "Eğitimler", icon: "training" });
  if (on.has("personel_bordro") && can("payroll.read")) items.push({ href: "/bordrolar", label: "Bordrolar", icon: "payroll" });
  if (on.has("personel_savunma") && can("defenses.read")) items.push({ href: "/savunmalar", label: "Savunmalar ve İhtarlar", icon: "defense" });

  if (on.has("formlar") && can("forms.read")) items.push({ href: "/formlar", label: "Formlar", icon: "forms" });

  if (on.has("puantaj") && can("timesheets.read")) items.push({ href: "/puantaj", label: "Puantaj", icon: "timesheets" });
  if (on.has("vardiya") && can("shifts.read")) items.push({ href: "/vardiya", label: "Vardiya Planı", icon: "shifts" });
  if (on.has("izin_yonetimi") && can("leaves.read")) items.push({ href: "/izinler", label: "İzin Yönetimi", icon: "leaves" });
  if (on.has("denetimler") && can("inspections.read")) items.push({ href: "/denetimler", label: "Denetimler", icon: "inspections" });
  const patrol = [
    { href: "/devriye/okut", label: "Barkod Okut", perm: "patrol.scan" },
    { href: "/devriye/rapor", label: "Devriye Rapor", perm: "patrol.read" },
  ].filter((c) => on.has("devriye") && can(c.perm));
  if (patrol.length) items.push({ href: patrol[0].href, label: "Devriye Sistemi", icon: "patrol", badge: "Demo", match: ["/devriye"], children: patrol.map(({ href, label }) => ({ href, label })) });

  if (on.has("risk_analizi") && can("risk.read")) items.push({ href: "/risk-analizi", label: "Risk Analizi", icon: "risk" });

  const cariOn = on.has("cari_hesap") && can("ledger.read");
  const fatOn = on.has("cari_faturalar") && can("invoices.read");
  if (cariOn || fatOn) {
    items.push({
      href: cariOn ? "/cari-hesap" : "/cari-hesap/faturalar",
      label: "Cari Hesap",
      icon: "ledger",
      exact: cariOn && fatOn,
      match: ["/cari-hesap"],
      children: fatOn && cariOn ? [{ href: "/cari-hesap", label: "Cari Ekstre", exact: true }, { href: "/cari-hesap/faturalar", label: "Faturalar" }] : undefined,
    });
  }

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
    { href: "/vardiya", label: "Vardiya Planı", icon: "shifts", anyOf: ["shifts.read"] },
    { href: "/izinler", label: "İzin Yönetimi", icon: "leaves", anyOf: ["leaves.read"] },
    { href: "/sozlesmeler", label: "Sözleşmeler", icon: "contracts", anyOf: ["contracts.read"] },
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
    .map((d) => ({
      href: d.href, label: d.label, icon: d.icon, exact: d.exact, group: d.group, match: d.match, badge: d.badge,
      ...(d.icon === "patrol"
        ? {
            children: [
              ...(canAnywhere(user, "patrol.read") ? [{ href: "/devriye/rapor", label: "Devriye Rapor" }] : []),
              ...(canAnywhere(user, "patrol.manage") ? [{ href: "/devriye/noktalar", label: "Noktalar ve Etiketler" }] : []),
            ],
          }
        : {}),
    }));
}

export function menuFor(user: CurrentUser, enabledModules: Set<string>): NavItem[] {
  return user.kind === "customer" ? customerMenu(user, enabledModules) : staffMenu(user);
}
