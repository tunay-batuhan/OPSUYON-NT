import "server-only";
import { accruedAnnualLeave, LEAVE_TYPE_INFO, splitAccrual } from "@/lib/leave-law";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
const DEDUCTING = LEAVE_TYPE_INFO.filter((t) => t.deducts).map((t) => t.code);
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Bir yılın yıllık izin bakiyesi için "hak edilen" ve "devreden" günler (otomatik hesap).
 *  - Hak edilen: o takvim yılı içindeki kıdem yıldönümünde kazanılan yasal hak (İş K. md. 53; yıldönümü gelmediyse 0).
 *  - Devreden: önceki yılın bakiye satırı varsa onun kalanı (satırdaki kalan − o yıl kaydedilen yıllık izinler);
 *    yoksa (sisteme yeni giren, eski tarihli personel) önceki yıllarda biriken hak.
 * Geçmişte sistem dışında kullanılmış izin bilinemez; merkez bakiyeyi "Düzelt" ile elle düzeltir.
 */
export async function openingLeaveBalance(
  supabase: Db, personnelId: string, year: number, hireDate: string, birthDate: string | null, at: Date,
): Promise<{ entitled_days: number; carried_days: number; metadata: Record<string, unknown> }> {
  const acc = accruedAnnualLeave(hireDate, birthDate, at);
  const split = splitAccrual(acc, year);
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
    return { entitled_days: split.entitled, carried_days: Math.max(0, round1(Number(prev.remaining_days) - used)), metadata: { auto: true, carried_from: year - 1 } };
  }
  return { entitled_days: split.entitled, carried_days: split.carried, metadata: { auto: true, accrued: acc.detail } };
}

/**
 * Otomatik bakiyeleri güncel tutar (İzin Yönetimi ekranları açılırken çağrılır):
 *  - bu yılın satırı olan ve ELLE düzeltilmemiş (metadata.manual ≠ true) her personelde hak edilen / devreden,
 *    bugünkü kıdem ve yaşa göre yeniden hesaplanır (yıl içinde yıldönümü gelince, 50 yaş kuralıyla hak artınca…);
 *  - işe giriş tarihi olan, ayrılmamış ve hakkı doğmuş ama bu yıl satırı olmayan personele satır açılır.
 * Elle girilen / düzeltilen ve Excel'den aktarılan bakiyelere dokunulmaz. Değişiklik yoksa yazma yapılmaz.
 */
export async function syncLeaveBalances(now: Date = new Date()): Promise<number> {
  const admin = createAdminClient();
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric" }).format(now));
  const { data: people } = await admin.from("personnel").select("id, hire_date, status").not("hire_date", "is", null).neq("status", "terminated").limit(5000);
  const list = (people ?? []) as { id: string; hire_date: string; status: string }[];
  if (!list.length) return 0;
  const ids = list.map((p) => p.id);
  const [{ data: births }, { data: rows }, { data: recs }] = await Promise.all([
    admin.from("personnel_personal").select("personnel_id, birth_date").in("personnel_id", ids),
    admin.from("leave_balances").select("id, personnel_id, year, entitled_days, carried_days, remaining_days, metadata").in("personnel_id", ids).in("year", [year - 1, year]),
    admin.from("leave_records").select("personnel_id, days").in("personnel_id", ids).in("leave_type", DEDUCTING).gte("start_date", `${year - 1}-01-01`).lte("start_date", `${year - 1}-12-31`),
  ]);
  const birthOf = new Map(((births ?? []) as { personnel_id: string; birth_date: string | null }[]).map((b) => [b.personnel_id, b.birth_date]));
  type Row = { id: string; personnel_id: string; year: number; entitled_days: number; carried_days: number; remaining_days: number; metadata: Record<string, unknown> | null };
  const cur = new Map<string, Row>(), prev = new Map<string, Row>();
  for (const r of (rows ?? []) as Row[]) (Number(r.year) === year ? cur : prev).set(r.personnel_id, r);
  const usedPrev = new Map<string, number>();
  for (const r of (recs ?? []) as { personnel_id: string; days: number }[]) usedPrev.set(r.personnel_id, (usedPrev.get(r.personnel_id) ?? 0) + Number(r.days));

  let changed = 0;
  for (const p of list) {
    const acc = accruedAnnualLeave(p.hire_date, birthOf.get(p.id) ?? null, now);
    const split = splitAccrual(acc, year);
    const pr = prev.get(p.id);
    const carried = pr ? Math.max(0, round1(Number(pr.remaining_days) - (usedPrev.get(p.id) ?? 0))) : split.carried;
    const row = cur.get(p.id);
    const metadata = pr ? { auto: true, carried_from: year - 1 } : { auto: true, accrued: acc.detail };
    if (!row) {
      if (split.entitled + carried <= 0) continue; // hakkı doğmamış: satır gerekmez
      const { error } = await admin.from("leave_balances").upsert(
        { personnel_id: p.id, year, entitled_days: split.entitled, carried_days: carried, used_days: 0, metadata },
        { onConflict: "personnel_id,year", ignoreDuplicates: true },
      );
      if (!error) changed++;
      continue;
    }
    if (row.metadata?.manual === true) continue;
    if (Number(row.entitled_days) === split.entitled && Number(row.carried_days) === carried) continue;
    const { error } = await admin.from("leave_balances").update({ entitled_days: split.entitled, carried_days: carried, metadata: { ...(row.metadata ?? {}), ...metadata } }).eq("id", row.id);
    if (!error) changed++;
  }
  return changed;
}
