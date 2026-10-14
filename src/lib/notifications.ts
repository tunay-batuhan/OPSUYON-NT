import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type NotificationCounts = { unread_threads: number; upcoming_contracts: number; new_documents: number; total: number };

/** One cheap RPC; memoised per request. */
export const getNotificationCounts = cache(async (): Promise<NotificationCounts> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_notification_counts");
  const d = (data ?? {}) as Partial<NotificationCounts>;
  const unread_threads = d.unread_threads ?? 0;
  const upcoming_contracts = d.upcoming_contracts ?? 0;
  const new_documents = d.new_documents ?? 0;
  return { unread_threads, upcoming_contracts, new_documents, total: unread_threads + upcoming_contracts + new_documents };
});
