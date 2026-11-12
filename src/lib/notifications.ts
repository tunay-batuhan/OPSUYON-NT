import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, isSuperAdmin, type CurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";

export type NotificationCounts = {
  unread_threads: number;
  upcoming_contracts: number;
  new_documents: number;
  /** Web sitesi iletişim formundan gelen "yeni" mesajlar — yalnızca Süper Yönetici için, diğerlerinde 0. */
  contact_messages: number;
  total: number;
};

/**
 * One cheap RPC (`my_notification_counts`, scoped by auth.uid()). `kind` comes from the already
 * validated session, so callers that have the user (layout, /api/notifications/count) don't load it twice.
 */
export async function loadNotificationCounts(user: Pick<CurrentUser, "kind" | "roleCode"> | null | undefined): Promise<NotificationCounts> {
  const kind = user?.kind;
  const supabase = await createClient();
  // İletişim talepleri tablosuna oturumlu erişim yok: sayı, Süper Yönetici olduğu doğrulandıktan sonra servis anahtarıyla alınır.
  const [{ data }, contactRes] = await Promise.all([
    supabase.rpc("my_notification_counts"),
    isSuperAdmin(user)
      ? createAdminClient().from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "yeni")
      : Promise.resolve({ count: 0 }),
  ]);
  const contact_messages = contactRes.count ?? 0;
  const d = (data ?? {}) as Partial<NotificationCounts>;
  const unread_threads = d.unread_threads ?? 0;
  // Müşteri ana sayfasından "Yaklaşan Sözleşme" kalktı: modül kapalıyken sayaca da girmez
  const showContracts = kind === "staff" || (await getEnabledModules()).has("yaklasan_sozlesme");
  const upcoming_contracts = showContracts ? (d.upcoming_contracts ?? 0) : 0;
  const new_documents = d.new_documents ?? 0;
  return { unread_threads, upcoming_contracts, new_documents, contact_messages, total: unread_threads + upcoming_contracts + new_documents + contact_messages };
}

/** Memoised per request. */
export const getNotificationCounts = cache(async (): Promise<NotificationCounts> => {
  const user = await getCurrentUser();
  return loadNotificationCounts(user);
});
