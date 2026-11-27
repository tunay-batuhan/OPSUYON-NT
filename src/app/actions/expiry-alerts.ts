"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { seesExpiryAlerts } from "@/lib/expiry-alerts";
import { createClient } from "@/lib/supabase/server";

/** Süre uyarısını bugün için kapatır (ertesi gün yeniden çıkar). `printed`: personele bildirim evrakı basıldı. */
export async function dismissExpiryAlert(input: { personnelId: string; kind: string; printed: boolean }): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || !seesExpiryAlerts(user)) return { error: "Yetkiniz yok." };
  if (!/^[0-9a-f-]{36}$/i.test(input?.personnelId ?? "") || !["health_report", "security_card"].includes(input?.kind)) return { error: "Geçersiz uyarı." };
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const { error } = await supabase
    .from("expiry_alert_dismissals")
    .upsert(
      { user_id: user.id, personnel_id: input.personnelId, kind: input.kind, dismissed_on: today, printed: Boolean(input.printed) },
      { onConflict: "user_id,personnel_id,kind" },
    );
  if (error) return { error: "Uyarı kapatılamadı." };
  revalidatePath("/bildirimler");
  return {};
}
