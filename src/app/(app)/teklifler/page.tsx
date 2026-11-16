import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, FileDown, FileText, Plus, TrendingUp, Wallet } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Stat, Table, btn, cn, td, tdNum } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { hasPermission, requireStaff } from "@/lib/auth";
import { pagingFrom } from "@/lib/paging";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { OFFER_STATUS } from "@/lib/offer-calc";
import {
  hasFilters, loadCreatorNames, loadCreatorOptions, loadOfferSummary, loadOffers, offerFilterQuery, offerFiltersFrom,
} from "./data";

export const metadata: Metadata = { title: "Teklifler" };

/**
 * Teklif listesi ve raporu: tarih aralığı, durum, hazırlayan ve müşteri adına göre süzülür; üstte sayaçlar,
 * altta sayfalı liste. "Rapor PDF" aynı süzgeçlerle tüm listeyi indirir.
 */
export default async function OffersPage({ searchParams }: PageProps<"/teklifler">) {
  const user = await requireStaff();
  const manage = hasPermission(user, "offers.manage");
  if (!manage && !hasPermission(user, "offers.read")) redirect("/merkez?yetki=yok");
  const sp = await searchParams;
  const f = offerFiltersFrom(sp);
  const { from, to } = pagingFrom(sp);

  const [{ rows, total }, summary, creators] = await Promise.all([loadOffers(f, { from, to }), loadOfferSummary(f), loadCreatorOptions()]);
  const names = await loadCreatorNames(rows.map((r) => r.created_by));
  const query = offerFilterQuery(f);
  const filtered = hasFilters(f);

  return (
    <>
      <FilterBar
        action="/teklifler"
        fields={[
          { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange", value: f.start, valueTo: f.end },
          { name: "durum", label: "Durum", value: f.status, all: "Tümü", options: Object.entries(OFFER_STATUS).map(([value, s]) => ({ value, label: s.label })) },
          { name: "hazirlayan", label: "Hazırlayan", value: f.by, all: "Herkes", options: creators },
          { name: "musteri", label: "Müşteri", kind: "text", value: f.q, placeholder: "Müşteri / site adı…" },
        ]}
      >
        {filtered && <Link href="/teklifler" className="self-center text-sm text-muted hover:text-fg">Temizle</Link>}
      </FilterBar>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Toplam teklif" value={formatNumber(summary.total)} icon={FileText} tone="blue" hint={`${summary.open} bekleyen (taslak + gönderildi)`} />
        <Stat
          label="Kabul / red"
          value={`${summary.accepted} / ${summary.rejected}`}
          icon={CheckCircle2}
          tone="emerald"
          hint={summary.acceptRate === null ? "Henüz karar verilmiş teklif yok" : `Kabul oranı %${formatNumber(Math.round(summary.acceptRate * 1000) / 10)}`}
        />
        <Stat label="Kabul edilen aylık tutar" value={formatMoney(summary.acceptedMonthly)} icon={Wallet} tone="violet" hint="Kabul edilen tekliflerin aylık OPSÜYON tutarı" />
        <Stat label="Yıllık kâr potansiyeli" value={formatMoney(summary.yearlyPotential)} icon={TrendingUp} tone="amber" hint="Tüm tekliflerde müşterilere gösterilen yıllık net kâr" />
      </div>

      <Card>
        <CardHeader
          title={`${total} teklif`}
          description={filtered ? "Süzgeçlere uyan teklifler, en yeni üstte" : "En yeni üstte"}
          action={
            <div className="flex flex-wrap gap-2">
              <a href={`/api/teklifler/rapor${query ? `?${query}` : ""}`} className={btn("secondary", "sm")}>
                <FileDown className="size-4" aria-hidden /> Rapor PDF
              </a>
              {manage && (
                <Link href="/teklifler/yeni" className={btn("primary", "sm")}>
                  <Plus className="size-4" aria-hidden /> Yeni teklif
                </Link>
              )}
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "Süzgeçlere uyan teklif yok" : "Henüz teklif yok"}
            description={manage && !filtered ? "“Yeni teklif” ile müşterinin yanında tabletten teklif hazırlayabilirsiniz." : undefined}
          />
        ) : (
          <>
            <Table
              numeric={[2, 3, 4, 5, 6]}
              head={["Teklif no", "Müşteri", "Kişi", "Aylık matrah", "OPSÜYON aylık", "Aylık kâr", "Yıllık kâr", "Durum", "Tarih", "Hazırlayan"]}
            >
              {rows.map((r) => {
                const s = OFFER_STATUS[r.status];
                return (
                  <tr key={r.id} className="hover:bg-surface-2/50">
                    <td className={cn(td, "whitespace-nowrap font-medium")}>
                      <Link href={`/teklifler/${r.id}`} className="text-brand-hover hover:underline">{r.offer_no}</Link>
                    </td>
                    <td className={td}>
                      <Link href={`/teklifler/${r.id}`} className="font-medium hover:underline">{r.customer_name}</Link>
                      {r.contact_name && <p className="text-xs text-muted">{r.contact_name}</p>}
                    </td>
                    <td className={tdNum}>{formatNumber(r.total_people)}</td>
                    <td className={cn(tdNum, "whitespace-nowrap")}>{formatMoney(r.monthly_base)}</td>
                    <td className={cn(tdNum, "whitespace-nowrap")}>{formatMoney(r.offer_total)}</td>
                    <td className={cn(tdNum, "whitespace-nowrap", r.monthly_profit < 0 && "text-danger")}>{formatMoney(r.monthly_profit)}</td>
                    <td className={cn(tdNum, "whitespace-nowrap font-semibold", r.yearly_profit < 0 ? "text-danger" : "text-[#b45309]")}>{formatMoney(r.yearly_profit)}</td>
                    <td className={td}><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className={cn(td, "whitespace-nowrap")}>{formatDate(r.created_at)}</td>
                    <td className={cn(td, "text-muted")}>{(r.created_by && names.get(r.created_by)) || "—"}</td>
                  </tr>
                );
              })}
            </Table>
            <Pagination path="/teklifler" searchParams={sp} total={total} />
          </>
        )}
      </Card>
    </>
  );
}
