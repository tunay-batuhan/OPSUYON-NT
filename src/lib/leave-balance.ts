import "server-only";
import { accruedAnnualLeave, LEAVE_TYPE_INFO } from "@/lib/leave-law";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
const DEDUCTING = LEAVE_TYPE_INFO.filter((t) => t.deducts).map((t) => t.code);

/**
 * Bir yılın yıllık izin bakiyesi ilk kez açılırken yazılacak "hak edilen" ve "devreden" günler.
 *  - Hak edilen: son kıdem yıldönümünde kazanılan yasal hak (İş K. md. 53).
 *  - Devreden: önceki yılın bakiye satırı varsa onun kalanı (satırdaki kalan − o yıl kaydedilen yıllık izinler);
 *    yoksa (sisteme yeni giren, eski tarihli personel) işe girişten bu yana önceki yıldönümlerinde biriken hak.
 * Geçmişte sistem dışında kullanılmış izin bilinemez; merkez bakiyeyi "Düzelt" ile elle düzeltir.
 */
export async function openingLeaveBalance(
  supabase: Db, personnelId: string, year: number, hireDate: string, birthDate: string | null, at: Date,
): Promise<{ entitled_days: number; carried_days: number; metadata: Record<string, unknown> }> {
  const acc = accruedAnnualLeave(hireDate, birthDate, at);
  const { data: prev } = await supabase
    .from("leave_balances")
    .select("remaining_days")
    .eq("personnel_id", personnelId)
    .eq("year", year - 1)
    .maybeSingle();
  if (prev) {
    const { data: recs } = await supabase
      .from("leave_records")
      .select("days")
      .eq("personnel_id", personnelId)
      .in("leave_type", DEDUCTING)
      .gte("start_date", `${year - 1}-01-01`)
      .lte("start_date", `${year - 1}-12-31`);
    const used = (recs ?? []).reduce((s, r) => s + Number(r.days), 0);
    const carried = Math.max(0, Math.round((Number(prev.remaining_days) - used) * 10) / 10);
    return { entitled_days: acc.current, carried_days: carried, metadata: { auto: true, carried_from: year - 1 } };
  }
  return { entitled_days: acc.current, carried_days: acc.carried, metadata: { auto: true, accrued: acc.detail } };
}
