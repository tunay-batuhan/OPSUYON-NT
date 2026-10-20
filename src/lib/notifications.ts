import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";

export type NotificationCounts = { unread_threads: number; upcoming_contracts: number; new_documents: number; total: number };

/** One cheap RPC; memoised per request. */
export const getNotificationCounts = cache(async (): Promise<NotificationCounts> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_notification_counts");
  const d = (data ?? {}) as Partial<NotificationCounts>;
  const unread_threads = d.unread_threads ?? 0;
  // Müşteri ana sayfasından "Yaklaşan Sözleşme" kalktı: modül kapalıyken sayaca da girmez
  const user = await getCurrentUser();
  const showContracts = user?.kind === "staff" || (await getEnabledModules()).has("yaklasan_sozlesme");
  const upcoming_contracts = showContracts ? (d.upcoming_contracts ?? 0) : 0;
  const new_documents = d.new_documents ?? 0;
  return { unread_threads, upcoming_contracts, new_documents, total: unread_threads + upcoming_contracts + new_documents };
});
