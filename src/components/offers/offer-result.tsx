import { formatMoney, formatNumber } from "@/lib/format";
import { formatRate, type OfferCalc } from "@/lib/offer-calc";
import { cn } from "@/components/ui";

/**
 * "OPSÜYON ile kâra geçin" tablosu (müşterinin Excel görünümü): turuncu başlık, lacivert sütun başlıkları,
 * hizmet satırları, toplam ve KDV, OPSÜYON teklifi, aylık ve yıllık net kâr. Hem tabletteki canlı hesapta
 * hem teklif sayfasında kullanılır. Kâr eksiye düşerse kırmızı gösterilir.
 */
export function OfferResult({ calc, vatRate, fee, className }: { calc: OfferCalc; vatRate: number; fee: number; className?: string }) {
  const loss = calc.monthly_profit < 0;
  const orange = "bg-[var(--tone-amber)]";
  const navy = "bg-[var(--navy)] text-white";
  const rows = calc.lines.filter((l) => l.service);
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-surface shadow-card", className)}>
      <p className={cn(orange, "px-4 py-3 text-center text-lg font-extrabold tracking-wide text-white sm:text-xl")}>OPSÜYON İLE KÂR&apos;A GEÇİN</p>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm tabular-nums sm:text-[15px]">
          <thead>
            <tr className={navy}>
              <th scope="col" className="px-3 py-3 text-left font-semibold">Satın alınan hizmet</th>
              <th scope="col" className="px-3 py-3 text-center font-semibold">Kişi sayısı</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Kişi başı hizmet bedeli</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Hizmet tutarı <span className="block text-xs font-normal text-white/75">aylık, KDV hariç matrah</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted">Hizmet satırı yok</td>
              </tr>
            )}
            {rows.map((l, i) => (
              <tr key={`${l.service}-${i}`}>
                <td className="px-3 py-2.5 font-medium">{l.service}</td>
                <td className="px-3 py-2.5 text-center">{formatNumber(l.people)}</td>
                <td className="px-3 py-2.5 text-right">{l.unit_price === null ? "" : formatMoney(l.unit_price)}</td>
                <td className="px-3 py-2.5 text-right">{formatMoney(l.monthly_total)}</td>
              </tr>
            ))}
            <tr className="bg-surface-2/60 font-semibold">
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-center">{formatNumber(calc.total_people)}</td>
              <td className="px-3 py-2.5 text-right">TOPLAM</td>
              <td className="px-3 py-2.5 text-right">{formatMoney(calc.monthly_base)}</td>
            </tr>
            <tr className="bg-surface-2/60 font-semibold">
              <td className="px-3 py-2.5" colSpan={2} />
              <td className="px-3 py-2.5 text-right">KDV %{formatRate(vatRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatMoney(calc.monthly_vat)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl className={cn(navy, "mt-3 divide-y divide-white/15")}>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="font-semibold">OPSÜYON kişi başı teklif tutarı</dt>
          <dd className="font-bold tabular-nums">{formatMoney(fee)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="font-semibold">Toplam teklif tutarı <span className="text-xs font-normal text-white/75">({formatNumber(calc.total_people)} kişi, aylık)</span></dt>
          <dd className="font-bold tabular-nums">{formatMoney(calc.offer_total)}</dd>
        </div>
      </dl>

      <div className={cn("mt-3 flex items-center justify-between gap-4 px-4 py-3", loss ? "bg-danger text-white" : navy)}>
        <span className="font-bold">AYLIK NET KÂR&apos;INIZ</span>
        <span className="text-lg font-extrabold tabular-nums">{formatMoney(calc.monthly_profit)}</span>
      </div>
      <div className={cn("mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 text-white", loss ? "bg-danger" : orange)}>
        <span className="text-xl font-extrabold sm:text-2xl">YILLIK NET KÂR&apos;INIZ</span>
        <span className="text-2xl font-extrabold tabular-nums sm:text-3xl">{formatMoney(calc.yearly_profit)}</span>
      </div>
      {loss && (
        <p role="status" className="bg-danger-soft px-4 py-2.5 text-sm text-danger">
          Teklif tutarı, müşterinin ödediği KDV&apos;den yüksek: bu tekliflerle müşteri kâr etmez. Kişi başı tutarı ya da kişi sayısını kontrol edin.
        </p>
      )}
    </div>
  );
}
