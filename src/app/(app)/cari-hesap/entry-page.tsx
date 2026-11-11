import { Card, CardHeader, EmptyState } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { istanbulNow } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { LedgerKind } from "@/lib/schemas-ledger";
import { LedgerEntryForm } from "./entry-form";

/** Fatura girişi ve Tahsilat girişi sekmelerinin ortak gövdesi (yalnızca merkez, finance.manage). */
export async function LedgerEntryPage({ kind }: { kind: LedgerKind }) {
  await requireStaff("finance.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id, name").eq("status", "active").order("name").limit(2000);
  const firms = ((data ?? []) as { id: string; name: string }[])
    .map((o) => ({ value: o.id, label: o.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  const { date, time } = istanbulNow();
  const fatura = kind === "fatura";

  return (
    <Card>
      <CardHeader
        title={fatura ? "Fatura girişi" : "Tahsilat girişi"}
        description={
          fatura
            ? "Firmayı seçin; fatura tarihi, saati, açıklaması ve genel toplamı girin. Fatura firmanın cari bakiyesini artırır."
            : "Firmayı seçin; tahsilat tarihi, saati, açıklaması ve tutarı girin. Tahsilat firmanın cari bakiyesini düşürür."
        }
      />
      {firms.length === 0 ? (
        <EmptyState title="Aktif firma yok" description="Önce Firmalar ekranından bir firma ekleyin." />
      ) : (
        <LedgerEntryForm kind={kind} firms={firms} today={date} now={time} />
      )}
    </Card>
  );
}
