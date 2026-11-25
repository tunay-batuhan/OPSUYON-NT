import { formatMoney, formatNumber } from "@/lib/format";
import { formatRate, type CostResult, type OfferCalc } from "@/lib/offer-calc";
import { cn } from "@/components/ui";

/**
 * Teklif sonucu (tabletteki canlı hesap ve teklif sayfası).
 *  - Her iki türde teklif tablosu: hizmet, kişi, kişi başı bedel, aylık bedel, toplam, KDV ve genel toplam (KDV dahil).
 *  - `compare` kapalı (yalnızca teklif): yalnızca bu tablo.
 *  - `compare` açık (maliyet karşılaştırma): en üstte büyük Aylık / Yıllık net kâr kartları, iki kazanç kalemi (KDV farkı,
 *    şirket kâr payı), teklif tablosu ve karşılaştırma (bugün ödenen vs OPSUYON ile). Kâr eksiye düşerse kırmızı gösterilir.
 */
export function OfferResult({
  calc, vatRate, fee, profitPct, compare = true, className,
}: { calc: OfferCalc; vatRate: number; fee: number; profitPct: number; compare?: boolean; className?: string }) {
  const loss = compare && calc.monthly_profit < 0;
  const navy = "bg-[var(--navy)] text-white";
  const named = calc.lines.filter((l) => l.service);
  const rows = named.some((l) => l.people > 0) ? named.filter((l) => l.people > 0) : named;
  return (
    <div className={cn("space-y-4", className)}>
      {/* büyük kâr kartları */}
      {compare && (<>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={cn("rounded-2xl px-5 py-4 shadow-card", loss ? "bg-danger text-white" : navy)}>
          <p className="text-xs font-bold uppercase tracking-wide text-white/75">Aylık net kâr&apos;ınız</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums sm:text-3xl">{formatMoney(calc.monthly_profit)}</p>
        </div>
        <div className={cn("rounded-2xl px-5 py-4 text-white shadow-card", loss ? "bg-danger" : "bg-[var(--tone-amber)]")}>
          <p className="text-xs font-bold uppercase tracking-wide text-white/85">Yıllık net kâr&apos;ınız</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums sm:text-3xl">{formatMoney(calc.yearly_profit)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">KDV farkı</dt>
          <dd className={cn("mt-0.5 text-xl font-bold tabular-nums", calc.vat_saving < 0 && "text-danger")}>{formatMoney(calc.vat_saving)}</dd>
          <dd className="mt-0.5 text-xs text-muted">KDV {formatMoney(calc.monthly_vat)} − OPSUYON {formatMoney(calc.offer_total)}</dd>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Şirket kâr payı</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums">{formatMoney(calc.profit_share_total)}</dd>
          <dd className="mt-0.5 text-xs text-muted">%{formatRate(profitPct)} kâr payı × {formatNumber(calc.total_people)} personel</dd>
        </div>
      </dl>
      </>)}

      {/* teklif tablosu */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <p className="bg-[var(--tone-amber)] px-4 py-2.5 text-center text-base font-extrabold tracking-wide text-white sm:text-lg">{compare ? <>OPSUYON İLE KÂR&apos;A GEÇİN</> : "HİZMET TEKLİFİ"}</p>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm tabular-nums">
            <thead>
              <tr className={navy}>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Satın alınan hizmet</th>
                <th scope="col" className="px-3 py-2.5 text-center font-semibold">Kişi sayısı</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Kişi başı bedel</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Aylık bedel <span className="block text-xs font-normal text-white/75">KDV hariç</span></th>
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
                  <td className="px-3 py-2 font-medium">{l.service}</td>
                  <td className="px-3 py-2 text-center">{formatNumber(l.people)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(l.unit_price)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(l.monthly_total)}</td>
                </tr>
              ))}
              <tr className="bg-surface-2/60 font-semibold">
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-center">{formatNumber(calc.total_people)}</td>
                <td className="px-3 py-2 text-right">TOPLAM</td>
                <td className="px-3 py-2 text-right">{formatMoney(calc.monthly_base)}</td>
              </tr>
              <tr className="bg-surface-2/60 font-semibold">
                <td className="px-3 py-2" colSpan={2} />
                <td className="px-3 py-2 text-right">KDV %{formatRate(vatRate)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(calc.monthly_vat)}</td>
              </tr>
              <tr className="bg-[var(--tone-amber-soft)] font-bold">
                <td className="px-3 py-2.5" colSpan={2} />
                <td className="px-3 py-2.5 text-right">GENEL TOPLAM</td>
                <td className="px-3 py-2.5 text-right">{formatMoney(calc.current_total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* karşılaştırma */}
      {compare && (
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm tabular-nums">
            <thead>
              <tr className={navy}>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Aylık maliyet karşılaştırması</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Bugün</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">OPSUYON ile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2">Personel maliyeti</td>
                <td className="px-3 py-2 text-right">{formatMoney(calc.monthly_base - calc.profit_share_total)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(calc.monthly_base - calc.profit_share_total)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Şirket kâr payı (%{formatRate(profitPct)})</td>
                <td className="px-3 py-2 text-right">{formatMoney(calc.profit_share_total)}</td>
                <td className="px-3 py-2 text-right text-muted">—</td>
              </tr>
              <tr>
                <td className="px-3 py-2">KDV (%{formatRate(vatRate)})</td>
                <td className="px-3 py-2 text-right">{formatMoney(calc.monthly_vat)}</td>
                <td className="px-3 py-2 text-right text-muted">—</td>
              </tr>
              <tr>
                <td className="px-3 py-2">OPSUYON hizmet bedeli <span className="text-xs text-muted">({formatNumber(calc.total_people)} kişi × {formatMoney(fee)})</span></td>
                <td className="px-3 py-2 text-right text-muted">—</td>
                <td className="px-3 py-2 text-right">{formatMoney(calc.offer_total)}</td>
              </tr>
              <tr className="bg-surface-2/60 font-bold">
                <td className="px-3 py-2.5">Aylık toplam</td>
                <td className="px-3 py-2.5 text-right">{formatMoney(calc.current_total)}</td>
                <td className="px-3 py-2.5 text-right">{formatMoney(calc.opsuyon_total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      )}
      {loss && (
        <p role="status" className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">
          OPSUYON teklif tutarı, müşterinin kazancını (KDV + şirket kâr payı) aşıyor: bu teklifle müşteri kâr etmez. Kişi başı tutarı ya da kişi sayısını kontrol edin.
        </p>
      )}
    </div>
  );
}

/** Maliyet analiz tablosu (kişi başı; müşterinin Excel'indeki "TEKLİF DETAYI" satırlarının tamamı). Soluk satırlar çalışandan kesilen / bilgi tutarlarıdır. */
export function CostTable({ title, cost, className }: { title: string; cost: CostResult; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-surface", className)}>
      <p className="bg-[var(--navy)] px-3 py-2 text-sm font-bold text-white">{title} · maliyet analizi (kişi başı)</p>
      <table className="w-full text-sm tabular-nums">
        <tbody>
          {cost.rows.map((r, i) =>
            r.kind === "section" ? (
              <tr key={i} className="bg-surface-2/70">
                <th scope="colgroup" colSpan={2} className="px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted">{r.label}</th>
              </tr>
            ) : (
              <tr key={i} className={cn("border-t border-border", r.kind === "total" && "bg-[var(--tone-amber-soft)] font-bold", r.kind === "subtotal" && "font-semibold")}>
                <td className={cn("px-3 py-1.5", r.kind === "info" && "text-muted")}>{r.label}</td>
                <td className={cn("whitespace-nowrap px-3 py-1.5 text-right", r.kind === "info" && "text-muted")}>{r.kind === "count" ? formatNumber(r.value) : formatMoney(r.value)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
