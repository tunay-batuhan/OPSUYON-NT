import { AppShell } from "@/components/app-shell";
import { menuFor } from "@/lib/menu";
import { requireUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { getNotificationCounts } from "@/lib/notifications";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toLocaleUpperCase("tr")).join("");

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [counts, enabled] = await Promise.all([getNotificationCounts(), getEnabledModules()]);

  return (
    <AppShell
      items={menuFor(user, enabled)}
      home={user.kind === "staff" ? "/merkez" : "/panel"}
      kind={user.kind}
      notifications={counts.total}
      unreadMessages={counts.unread_threads}
      assistant={enabled.has("opsuyon_ai") && Boolean(process.env.CLAUDE_API_KEY)}
      user={{
        fullName: user.full_name,
        username: user.username,
        roleLabel: user.kind === "staff" ? (user.roleName ?? "Merkez") : "Müşteri",
        initials: initials(user.full_name),
        greetingName: user.kind === "staff" ? `Merkez Yönetim · ${user.full_name}` : user.full_name,
      }}
    >
      {children}
    </AppShell>
  );
}
