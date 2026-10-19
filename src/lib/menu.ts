import { canAnywhere, type CurrentUser } from "@/lib/auth";
import type { NavChild, NavItem } from "@/components/nav";

type Def = NavItem & { anyOf?: string[]; staffOnly?: boolean };

/**
 * Müşteri menüsü, müşterinin yazılı isteğine göre (docs/yol-haritasi.md):
 *   Ana Sayfa · Personel ▾ · Puantaj · Denetimler · Cari Hesap ▾
 * Her öğe bir "modül"dür; kapalı modüller menüde görünmez (Merkez → Müşteri modülleri).
 */
function customerMenu(user: CurrentUser, on: Set<string>): NavItem[] {
  const can = (perm: string) => canAnywhere(user, perm);
  const items: NavItem[] = [{ href: "/panel", label: "Ana Sayfa", icon: "home", exact: true }];

  if (on.has("projeler") && can("projects.read")) items.push({ href: "/projeler", label: "Projeler", icon: "projects", match: ["/projeler"] });

  const personnel: (NavChild & { mod: string; perm: string })[] = [
    { href: "/personel/sozlesmeler", label: "Personel Sözleşmeleri", mod: "personel_sozlesme", perm: "contracts.read" },
    { href: "/personel/ozluk", label: "Özlük Dosyaları", mod: "personel_ozluk", perm: "personnel.files.read" },
    { href: "/personel/bordrolar", label: "Bordrolar", mod: "personel_bordro", perm: "payroll.read" },
    { href: "/personel/izinler", label: "Yıllık İzinler", mod: "personel_izin", perm: "leaves.read" },
    { href: "/personel/kiyafet", label: "Kıyafet ve Ekipman", mod: "personel_kiyafet", perm: "uniform.read" },
    { href: "/personel/savunmalar", label: "Personele Savunmalar", mod: "personel_savunma", perm: "defenses.read" },
  ];
  const personnelChildren = personnel.filter((c) => on.has(c.mod) && can(c.perm)).map(({ href, label }) => ({ href, label }));
  if (personnelChildren.length) items.push({ href: personnelChildren[0].href, label: "Personel", icon: "personnel", match: ["/personel"], children: personnelChildren });

  if (on.has("puantaj") && can("timesheets.read")) items.push({ href: "/puantaj", label: "Puantaj", icon: "timesheets" });
  if (on.has("vardiya") && can("shifts.read")) items.push({ href: "/vardiya", label: "Vardiya Planı", icon: "shifts" });
  if (on.has("izin_yonetimi") && can("leaves.read")) items.push({ href: "/izinler", label: "İzin Yönetimi", icon: "leaves" });
  if (on.has("denetimler") && can("inspections.read")) items.push({ href: "/denetimler", label: "Denetimler", icon: "inspections" });

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
    { href: "/denetimler", label: "Denetimler", icon: "inspections", anyOf: ["inspections.read"] },
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
    .map((d) => ({ href: d.href, label: d.label, icon: d.icon, exact: d.exact, group: d.group, match: d.match }));
}

export function menuFor(user: CurrentUser, enabledModules: Set<string>): NavItem[] {
  return user.kind === "customer" ? customerMenu(user, enabledModules) : staffMenu(user);
}
