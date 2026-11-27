import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAnywhere, getCurrentUser, isSuperAdmin, type CurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { loadExpiryAlerts } from "@/lib/expiry-alerts";

export type NotificationCounts = {
  unread_threads: number;
  upcoming_contracts: number;
  new_documents: number;
  /** Web sitesi iletişim formundan gelen "yeni" mesajlar — yalnızca Süper Yönetici için, diğerlerinde 0. */
  contact_messages: number;
  /** İş Planlama: personelin sorun bildirdiği + "İşi bitirdim" dediği (kapatılmayı bekleyen) görevler */
  task_alerts: number;
  /** Sağlık raporu / güvenlik kimlik kartı bitişine 6 ay kala (bugün kapatılmamış) uyarılar — merkez */
  expiry_alerts: number;
  total: number;
};

/**
 * One cheap RPC (`my_notification_counts`, scoped by auth.uid()). `kind` comes from the already
 * validated session, so callers that have the user (layout, /api/notifications/count) don't load it twice.
 */
export async function loadNotificationCounts(user: Pick<CurrentUser, "id" | "kind" | "roleCode" | "permissions" | "allPermissions"> | null | undefined): Promise<NotificationCounts> {
  const kind = user?.kind;
  const supabase = await createClient();
  // İletişim talepleri tablosuna oturumlu erişim yok: sayı, Süper Yönetici olduğu doğrulandıktan sonra servis anahtarıyla alınır.
  // görev uyarıları: görevleri görebilen (tasks.read) merkez / müşteri; müşteride İş Planlama modülü açıksa. RLS süzer.
  const seesTasks = Boolean(user) && user!.kind !== "personnel" && canAnywhere(user!, "tasks.read") && (user!.kind === "staff" || (await getEnabledModules()).has("is_planlama"));
  // merkez kullanıcısına atanmış, yanıtını bekleyen merkez görevleri (ayrı sorgu: sütun henüz yoksa 0)
  const myId = user?.kind === "staff" ? user.id : undefined;
  const [{ data }, contactRes, taskRes, myTaskRes, expiry] = await Promise.all([
    supabase.rpc("my_notification_counts"),
    isSuperAdmin(user)
      ? createAdminClient().from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "yeni")
      : Promise.resolve({ count: 0 }),
    seesTasks
      ? supabase.from("work_tasks").select("id", { count: "exact", head: true }).or("status.eq.issue,and(status.eq.accepted,finished_by_personnel_at.not.is.null)")
      : Promise.resolve({ count: 0 }),
    myId
      ? supabase.from("work_tasks").select("id", { count: "exact", head: true }).eq("assignee_id", myId).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    loadExpiryAlerts(user),
  ]);
  const expiry_alerts = expiry.length;
  const task_alerts = (taskRes.count ?? 0) + (myTaskRes.count ?? 0);
  const contact_messages = contactRes.count ?? 0;
  const d = (data ?? {}) as Partial<NotificationCounts>;
  const unread_threads = d.unread_threads ?? 0;
  // Müşteri ana sayfasından "Yaklaşan Sözleşme" kalktı: modül kapalıyken sayaca da girmez
  const showContracts = kind === "staff" || (await getEnabledModules()).has("yaklasan_sozlesme");
  const upcoming_contracts = showContracts ? (d.upcoming_contracts ?? 0) : 0;
  const new_documents = d.new_documents ?? 0;
  return {
    unread_threads, upcoming_contracts, new_documents, contact_messages, task_alerts, expiry_alerts,
    total: unread_threads + upcoming_contracts + new_documents + contact_messages + task_alerts + expiry_alerts,
  };
}

/** Memoised per request. */
export const getNotificationCounts = cache(async (): Promise<NotificationCounts> => {
  const user = await getCurrentUser();
  return loadNotificationCounts(user);
});
