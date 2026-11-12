import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadNotificationCounts } from "@/lib/notifications";

/**
 * Üst çubuktaki bildirim zilinin canlı sayacı (components/notification-bell.tsx yoklar).
 * Yalnızca sayılar döner; mesaj içeriği yok. Paylaşılan layout gezinmede yeniden çizilmediği için
 * zil sayısı buradan tazelenir.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const counts = await loadNotificationCounts(user);
  return NextResponse.json(counts, { headers: { "Cache-Control": "private, no-store" } });
}
