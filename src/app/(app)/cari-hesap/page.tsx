import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ReceiptText, Scale, Wallet } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Stat, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { DeleteDocButton } from "@/components/delete-doc-button";
import { deleteFirmLedgerEntry } from "@/app/actions/firm-ledger";
import { hasPermission } from "@/lib/auth";
import { isUuid, str1 } from "@/lib/lookups";
import { requireAccess } from "@/lib/modules";
import { pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, istanbulNow } from "@/lib/format";
import { LEDGER_KIND_LABELS, type LedgerKind } from "@/lib/schemas-ledger";

export const metadata: Metadata = { title: "Cari Hesap" };

const PATH = "/cari-hesap";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Balance = {
  organization_id: string; organization_name: string | null;
  total_invoiced: number; total_collected: number; balance: number;
  entry_count: number; first_entry_date: string | null; last_entry_date: string | null;
};
type Movement = {
  id: string; kind: LedgerKind; entry_date: string; entry_time: string; description: string | null; amount: number; running_balance: number;
};
type Sp = Record<string, string | string[] | undefined>;

const BALANCE_COLS = "organization_id, organization_name, total_invoiced, total_collected, balance, entry_count, first_entry_date, last_entry_date";

/** Bakiye: pozitif → firma borçlu, negatif → fazla tahsilat (firma alacaklı). */
const balanceHint = (b: number) => (b > 0 ? "Firma borçlu" : b < 0 ? "Firma alacaklı" : "Hesap kapalı");
const balanceTone = (b: number) => (b > 0 ? "text-danger" : b < 0 ? "text-success" : "");

/**
 * Cari Hesap (firma bazlı): bakiye = tüm faturalar − tüm tahsilatlar.
 *  - Merkez: firma başına özet; firma seçilince o firmanın hareketleri (tür, tarih aralığı, sayfalı; finans yöneticisi silebilir).
 *  - Müşteri: kendi firmasının toplamları ve hareketleri (salt okunur).
 */
export default async function LedgerAllPage({ searchParams }: PageProps<"/cari-hesap">) {
  const user = await requireAccess("cari_hesap", "ledger.read");
  const sp = await searchParams;
  const supabase = await createClient();

  if (user.kind === "customer") {
    if (!user.organization_id) return <Card><EmptyState title="Hesabınız bir firmaya bağlı değil" /></Card>;
    const { data } = await supabase.from("firm_ledger_balances").select(BALANCE_COLS).eq("organization_id", user.organization_id).maybeSingle();
    return <FirmLedger orgId={user.organization_id} summary={data as Balance | null} sp={sp} manage={false} />;
  }

  const manage = hasPermission(user, "finance.manage");
  const firma = str1(sp.firma);
  const [{ data: bals }, { data: orgs }] = await Promise.all([
    supabase.from("firm_ledger_balances").select(BALANCE_COLS).order("organization_name").limit(2000),
    supabase.from("organizations").select("id, name, status").order("name").limit(2000),
  ]);
  const balances = (bals ?? []) as Balance[];
  // filtre seçenekleri: aktif firmalar + hareketi olan (arşivlenmiş olsa da) firmalar
  const withEntries = new Set(balances.map((b) => b.organization_id));
  const names = new Map<string, string>();
  for (const o of (orgs ?? []) as { id: string; name: string; status: string }[]) if (o.status === "active" || withEntries.has(o.id)) names.set(o.id, o.name);
  for (const b of balances) if (!names.has(b.organization_id)) names.set(b.organization_id, b.organization_name ?? "—");
  const firmOptions = [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "tr"));
  const firmField: FilterField = { name: "firma", label: "Firma", value: firma, all: "Tüm firmalar", options: firmOptions, searchable: true, placeholder: "Firma adı yazın…" };

  if (isUuid(firma)) {
    const summary = balances.find((b) => b.organization_id === firma) ?? null;
    return <FirmLedger orgId={firma} orgName={names.get(firma)} summary={summary} sp={sp} manage={manage} firmField={firmField} />;
  }

  const sum = (k: "total_invoiced" | "total_collected" | "balance") => balances.reduce((a, b) => a + Number(b[k]), 0);
  const totals = { inv: sum("total_invoiced"), col: sum("total_collected"), bal: sum("balance") };

  return (
    <>
      <FilterBar action={PATH} fields={[firmField]} />
      {balances.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Toplam fatura" value={formatMoney(totals.inv)} hint={`${balances.length} firma`} icon={ReceiptText} tone="blue" />
          <Stat label="Toplam tahsilat" value={formatMoney(totals.col)} icon={Wallet} tone="emerald" />
          <Stat label="Genel bakiye" value={formatMoney(totals.bal)} hint={balanceHint(totals.bal)} icon={Scale} tone={totals.bal > 0 ? "rose" : "teal"} />
        </div>
      )}
      <Card>
        <CardHeader title="Firma bazında cari" description="Bakiye = tüm faturalar − tüm tahsilatlar. Hareketleri görmek için firmaya tıklayın." />
        {balances.length === 0 ? (
          <EmptyState
            title="Henüz cari hareket yok"
            description={manage ? "“Fatura girişi” ve “Tahsilat girişi” sekmelerinden kayıt ekleyin." : "Fatura veya tahsilat girildiğinde burada görünür."}
          />
        ) : (
          <Table numeric={[1, 2, 3, 4]} head={["Firma", "Hareket", "Toplam fatura", "Toplam tahsilat", "Bakiye"]}>
            {balances.map((b) => (
              <tr key={b.organization_id}>
                <td className={td}>
                  <Link href={`${PATH}?firma=${b.organization_id}`} className="font-medium hover:text-brand">{names.get(b.organization_id) ?? b.organization_name ?? "—"}</Link>
                  <span className="block text-xs text-muted">Son hareket: {formatDate(b.last_entry_date)}</span>
                </td>
                <td className={tdNum}>{b.entry_count}</td>
                <td className={tdNum}>{formatMoney(b.total_invoiced)}</td>
                <td className={tdNum}>{formatMoney(b.total_collected)}</td>
                <td className={cn(tdNum, "font-semibold", balanceTone(Number(b.balance)))}>
                  {formatMoney(b.balance)}
                  <span className="block text-xs font-normal text-muted">{balanceHint(Number(b.balance))}</span>
                </td>
              </tr>
            ))}
            <tr className="bg-surface-2/60 font-semibold">
              <td className={td}>Toplam</td>
              <td className={tdNum}>{balances.reduce((a, b) => a + b.entry_count, 0)}</td>
              <td className={tdNum}>{formatMoney(totals.inv)}</td>
              <td className={tdNum}>{formatMoney(totals.col)}</td>
              <td className={cn(tdNum, balanceTone(totals.bal))}>{formatMoney(totals.bal)}</td>
            </tr>
          </Table>
        )}
      </Card>
    </>
  );
}

/** Tek firmanın cari hesabı: üç toplam + hareketler (tür, tarih aralığı, 10'ar kayıt, yürüyen bakiye). */
async function FirmLedger({
  orgId, orgName, summary, sp, manage, firmField,
}: { orgId: string; orgName?: string; summary: Balance | null; sp: Sp; manage: boolean; firmField?: FilterField }) {
  const supabase = await createClient();
  const tur = str1(sp.tur);
  const kind = tur === "fatura" || tur === "tahsilat" ? tur : undefined;
  const bas = str1(sp.bas);
  const bit = str1(sp.bit);
  const start = bas && ISO.test(bas) ? bas : undefined;
  const end = bit && ISO.test(bit) ? bit : undefined;
  const { from, to } = pagingFrom(sp);

  let q = supabase
    .from("firm_ledger_movements")
    .select("id, kind, entry_date, entry_time, description, amount, running_balance", { count: "exact" })
    .eq("organization_id", orgId)
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (kind) q = q.eq("kind", kind);
  if (start) q = q.gte("entry_date", start);
  if (end) q = q.lte("entry_date", end);
  const { data, count } = await q;
  const rows = (data ?? []) as Movement[];
  const total = count ?? 0;

  const inv = Number(summary?.total_invoiced ?? 0);
  const col = Number(summary?.total_collected ?? 0);
  const bal = Number(summary?.balance ?? 0);
  const name = orgName ?? summary?.organization_name ?? "Firma";

  // tarih aralığı kutusu boşken firmanın ilk ve son hareketini gösterir (süzgeç uygulanmaz)
  const today = istanbulNow().date;
  const last = summary?.last_entry_date && summary.last_entry_date > today ? summary.last_entry_date : today;
  const fields: FilterField[] = [
    ...(firmField ? [firmField] : []),
    { name: "tur", label: "Tür", value: kind, all: "Tümü", options: [{ value: "fatura", label: "Fatura" }, { value: "tahsilat", label: "Tahsilat" }] },
    { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange", value: start ?? summary?.first_entry_date ?? today, valueTo: end ?? last, max: last },
  ];
  const filtered = Boolean(kind || start || end);

  return (
    <>
      <FilterBar action={PATH} fields={fields}>
        {filtered && (
          <Link href={firmField ? `${PATH}?firma=${orgId}` : PATH} className="h-9 content-center text-sm text-muted hover:text-fg">Süzgeçleri temizle</Link>
        )}
      </FilterBar>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Toplam fatura" value={formatMoney(inv)} hint={`${summary?.entry_count ?? 0} hareket`} icon={ReceiptText} tone="blue" />
        <Stat label="Toplam tahsilat" value={formatMoney(col)} icon={Wallet} tone="emerald" />
        <Stat label="Bakiye" value={formatMoney(bal)} hint={`${balanceHint(bal)} · faturalar − tahsilatlar`} icon={Scale} tone={bal > 0 ? "rose" : "teal"} />
      </div>
      <Card>
        <CardHeader
          title={firmField ? `${name} — hareketler` : "Cari hareketler"}
          description={`${total} kayıt · en yeni üstte · Bakiye sütunu o hareketten sonraki bakiyedir`}
          action={firmField && (
            <Link href={PATH} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
              <ArrowLeft className="size-4" aria-hidden /> Tüm firmalar
            </Link>
          )}
        />
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "Süzgeçlere uyan hareket yok" : "Henüz cari hareket yok"}
            description={!filtered && manage ? "“Fatura girişi” ve “Tahsilat girişi” sekmelerinden kayıt ekleyin." : undefined}
          />
        ) : (
          <>
            <Table numeric={[4, 5]} head={["Tarih", "Saat", "Tür", "Açıklama", "Tutar", "Bakiye", ...(manage ? [""] : [])]}>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={cn(td, "whitespace-nowrap")}>{formatDate(r.entry_date)}</td>
                  <td className={cn(td, "tabular-nums")}>{r.entry_time.slice(0, 5)}</td>
                  <td className={td}><Badge tone={r.kind === "fatura" ? "brand" : "success"}>{LEDGER_KIND_LABELS[r.kind]}</Badge></td>
                  <td className={cn(td, "text-muted [overflow-wrap:anywhere]")}>{r.description ?? "—"}</td>
                  <td className={cn(tdNum, "font-medium", r.kind === "tahsilat" && "text-success")}>
                    {r.kind === "tahsilat" ? "−" : ""}{formatMoney(r.amount)}
                  </td>
                  <td className={cn(tdNum, "font-semibold", balanceTone(Number(r.running_balance)))}>{formatMoney(r.running_balance)}</td>
                  {manage && (
                    <td className={cn(td, "text-right")}>
                      <DeleteDocButton
                        id={r.id}
                        title={`${LEDGER_KIND_LABELS[r.kind]} ${formatDate(r.entry_date)}`}
                        back={PATH}
                        action={deleteFirmLedgerEntry}
                        confirm={{
                          title: `${LEDGER_KIND_LABELS[r.kind]} kaydı silinsin mi?`,
                          description: `Kayıt kalıcı olarak silinir ve ${name} bakiyesi buna göre değişir. Bu işlem geri alınamaz.`,
                          items: [`${formatDate(r.entry_date)} ${r.entry_time.slice(0, 5)} · ${formatMoney(r.amount)}${r.description ? ` · ${r.description}` : ""}`],
                        }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </Table>
            <Pagination path={PATH} searchParams={sp} total={total} />
          </>
        )}
      </Card>
    </>
  );
}
