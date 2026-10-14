import { canAnywhere, type CurrentUser } from "@/lib/auth";
import type { NavItem } from "@/components/nav";

type Def = NavItem & { anyOf?: string[]; staffOnly?: boolean };

/** Menu order and names follow docs/tasarim-referans.jpg. */
export function menuFor(user: CurrentUser): NavItem[] {
  const home = user.kind === "staff" ? "/merkez" : "/panel";
  const defs: Def[] = [
    { href: home, label: "Ana Sayfa", icon: "home", exact: true },
    { href: "/projeler", label: "Projeler", icon: "projects", anyOf: ["projects.read"], match: ["/projeler", "/merkez/projeler"] },
    { href: "/personel", label: "Personel", icon: "personnel", anyOf: ["personnel.read"], match: ["/personel", "/merkez/personel"] },
    { href: "/puantaj", label: "Puantaj", icon: "timesheets", anyOf: ["timesheets.read"] },
    { href: "/vardiya", label: "Vardiya Planı", icon: "shifts", anyOf: ["shifts.read"] },
    { href: "/izinler", label: "İzin Yönetimi", icon: "leaves", anyOf: ["leaves.read"] },
    { href: "/sozlesmeler", label: "Sözleşmeler", icon: "contracts", anyOf: ["contracts.read"] },
    { href: "/bordrolar", label: "Bordrolar", icon: "payroll", anyOf: ["payroll.read"] },
    { href: "/faturalar", label: "Faturalar", icon: "invoices", anyOf: ["invoices.read"] },
    { href: "/cari-hesap", label: "Cari Hesap", icon: "ledger", anyOf: ["ledger.read"] },
    { href: "/raporlar", label: "Raporlar", icon: "reports", anyOf: ["reports.read"] },
    { href: "/mesajlar", label: "Mesajlar", icon: "messages", anyOf: ["messages.use", "messages.manage"] },
    // merkez-only administration
    { href: "/merkez/firmalar", label: "Firmalar", icon: "organizations", anyOf: ["organizations.read"], staffOnly: true, group: "Yönetim" },
    { href: "/merkez/kullanicilar", label: "Kullanıcılar & hesaplar", icon: "users", anyOf: ["users.read"], staffOnly: true, group: "Yönetim" },
    { href: "/merkez/islem-gecmisi", label: "İşlem geçmişi", icon: "audit", anyOf: ["audit.read"], staffOnly: true, group: "Yönetim" },
  ];
  return defs
    .filter((d) => (!d.staffOnly || user.kind === "staff") && (!d.anyOf || d.anyOf.some((p) => canAnywhere(user, p))))
    .map((d) => ({ href: d.href, label: d.label, icon: d.icon, exact: d.exact, group: d.group, match: d.match }));
}
