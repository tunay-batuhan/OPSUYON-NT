import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav";
import { hasPermission, requireUser, type CurrentUser } from "@/lib/auth";

function navFor(user: CurrentUser): NavItem[] {
  if (user.kind === "customer") {
    return [
      { href: "/panel", label: "Projelerim", icon: "projects" },
      { href: "/mesajlar", label: "Merkez ile yazışma", icon: "messages" },
    ];
  }
  const items: (NavItem & { perm?: string })[] = [
    { href: "/merkez", label: "Genel bakış", icon: "dashboard", exact: true, group: "Panel" },
    { href: "/merkez/firmalar", label: "Firmalar", icon: "organizations", perm: "organizations.read", group: "Müşteriler" },
    { href: "/merkez/projeler", label: "Projeler", icon: "projects", perm: "projects.read", group: "Müşteriler" },
    { href: "/merkez/kullanicilar", label: "Kullanıcılar & hesaplar", icon: "users", perm: "users.read", group: "Müşteriler" },
    { href: "/merkez/personel", label: "Personel havuzu", icon: "personnel", perm: "personnel.read", group: "Operasyon" },
    { href: "/mesajlar", label: "Yazışmalar", icon: "messages", perm: "messages.manage", group: "Operasyon" },
    { href: "/merkez/islem-gecmisi", label: "İşlem geçmişi", icon: "audit", perm: "audit.read", group: "Sistem" },
  ];
  return items
    .filter((i) => !i.perm || hasPermission(user, i.perm))
    .map((i) => ({ href: i.href, label: i.label, icon: i.icon, exact: i.exact, group: i.group }));
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toLocaleUpperCase("tr")).join("");

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <AppShell
      items={navFor(user)}
      home={user.kind === "staff" ? "/merkez" : "/panel"}
      user={{
        fullName: user.full_name,
        username: user.username,
        roleLabel: user.kind === "staff" ? (user.roleName ?? "Merkez") : "Müşteri",
        initials: initials(user.full_name),
      }}
    >
      {children}
    </AppShell>
  );
}
