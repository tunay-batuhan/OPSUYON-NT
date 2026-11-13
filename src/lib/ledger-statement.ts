import "server-only";
import { createClient } from "@/lib/supabase/server";
import { istanbulNow } from "@/lib/format";
import type { LedgerKind } from "@/lib/schemas-ledger";

export type StatementRow = {
  id: string; kind: LedgerKind; entry_date: string; entry_time: string; description: string | null;
  amount: number; running_balance: number; file_name: string | null;
};

export type LedgerStatement = {
  organization: { id: string; name: string };
  start: string;
  end: string;
  kind: LedgerKind | null;
  /** Devir bakiyesi: başlangıç gününden önceki tüm hareketlerin bakiyesi */
  opening: number;
  /** Dönemdeki toplamlar (tür süzgecinden bağımsız; devir + fatura − tahsilat = dönem sonu) */
  invoiced: number;
  collected: number;
  closing: number;
  /** Listelenen hareketler (tür süzgeci uygulanmış), eskiden yeniye */
  rows: StatementRow[];
};

const COLS = "id, kind, entry_date, entry_time, description, amount, running_balance, file_name";

/**
 * Firma cari ekstresi (Cari Hesap → Rapor al). Okumalar çağıranın oturumuyla yapılır: RLS, müşterinin yalnızca
 * kendi firmasını görmesini sağlar. Tarih verilmezse ekrandaki gibi firmanın ilk hareketinden bugüne (ya da son harekete).
 * Yürüyen bakiye veritabanı görünümünde kronolojik hesaplanır; sıralama ve süzgeçler onu değiştirmez.
 */
export async function loadLedgerStatement(
  orgId: string,
  opts: { start?: string; end?: string; kind?: LedgerKind | null },
): Promise<LedgerStatement | null> {
  const supabase = await createClient();
  const [{ data: org }, { data: summary }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle(),
    supabase.from("firm_ledger_balances").select("organization_name, first_entry_date, last_entry_date").eq("organization_id", orgId).maybeSingle(),
  ]);
  if (!org && !summary) return null;
  const name = (org?.name as string | undefined) ?? (summary?.organization_name as string | null) ?? "Firma";

  const today = istanbulNow().date;
  const lastEntry = (summary?.last_entry_date as string | null) ?? null;
  let start = opts.start ?? (summary?.first_entry_date as string | null) ?? today;
  let end = opts.end ?? (lastEntry && lastEntry > today ? lastEntry : today);
  if (start > end) [start, end] = [end, start];

  // devir: başlangıçtan önceki son hareketin yürüyen bakiyesi
  const { data: before } = await supabase
    .from("firm_ledger_movements")
    .select("running_balance")
    .eq("organization_id", orgId)
    .lt("entry_date", start)
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const opening = Number(before?.running_balance ?? 0);

  // dönemdeki tüm hareketler (toplamlar için), 1000'er
  const all: StatementRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("firm_ledger_movements")
      .select(COLS)
      .eq("organization_id", orgId)
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date")
      .order("entry_time")
      .order("created_at")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as StatementRow[]).map((r) => ({ ...r, amount: Number(r.amount), running_balance: Number(r.running_balance) })));
    if (!data || data.length < 1000) break;
  }

  const sum = (k: LedgerKind) => Math.round(all.filter((r) => r.kind === k).reduce((a, r) => a + r.amount, 0) * 100) / 100;
  const invoiced = sum("fatura");
  const collected = sum("tahsilat");
  const closing = Math.round((opening + invoiced - collected) * 100) / 100;
  const kind = opts.kind ?? null;

  return {
    organization: { id: orgId, name },
    start, end, kind, opening, invoiced, collected, closing,
    rows: kind ? all.filter((r) => r.kind === kind) : all,
  };
}
