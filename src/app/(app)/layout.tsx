import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { menuFor } from "@/lib/menu";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { getNotificationCounts } from "@/lib/notifications";
import { openTaskAlerts } from "@/lib/tasks";

// Giriş arkasındaki hiçbir ekran arama motoruna girmez (SITE_INDEXABLE açık olsa da).
export const metadata: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toLocaleUpperCase("tr")).join("");

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  // personel hesabı panel menüsünü görmez: kendi sade ekranına (Görevlerim)
  if (user.kind === "personnel") redirect("/gorevlerim");
  const [counts, enabled, taskAlerts] = await Promise.all([
    getNotificationCounts(),
    getEnabledModules(),
    // merkez kullanıcısı: kendisine atanan, yanıtını bekleyen merkez görevleri de sayılır
    user.kind === "staff" ? openTaskAlerts(user.id) : canAnywhere(user, "tasks.read") ? openTaskAlerts() : Promise.resolve(0),
  ]);

  return (
    <AppShell
      items={menuFor(user, enabled, { taskAlerts })}
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
