"use client";

import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { saveOffer } from "@/app/actions/offers";
import { COST_INPUT_LABELS, calcCost, calcOffer, type CostParams } from "@/lib/offer-calc";
import { COST_FIELDS, EMPTY_LINE, lineCost, offerLines, offerNumbers, offerSchema, type OfferValues } from "@/lib/schemas-offers";
import { formatMoney } from "@/lib/format";
import { Form, FormGrid, TextField, TextareaField, control } from "@/components/forms/form";
import { DateField } from "@/components/forms/date-fields";
import { btn, cn } from "@/components/ui";
import { CostTable, OfferResult } from "@/components/offers/offer-result";

/** Tablette rahat dokunulan kutu (h-12, büyük yazı). */
const big = cn(control, "h-12 text-base");
const GRID = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_2.75rem]";

/**
 * Hizmet satırları. Teklif ekranı: hizmet, kişi sayısı, KİŞİ BAŞI BEDEL (yazılır) → aylık bedel (hesaplanır).
 * Maliyet karşılaştırma ekranı: her görev için maliyet tablosu girdileri (brüt maaş, yol, giderler…); kişi başı bedel
 * maliyet tablosundan hesaplanır ve tablonun tamamı altında gösterilir.
 */
function ServiceRows({ kind, params }: { kind: "teklif" | "maliyet"; params: CostParams }) {
  const { register, control: ctl, formState } = useFormContext<OfferValues>();
  const { fields, append, remove } = useFieldArray({ control: ctl, name: "lines" });
  const lines = useWatch({ control: ctl, name: "lines" }) ?? [];
  const pctText = useWatch({ control: ctl, name: "profit_pct" });
  const { pct } = offerNumbers({ vat_rate: "0", fee_per_person: "0", profit_pct: pctText ?? "" });
  const calc = calcOffer(offerLines(lines, kind), 0, 0, pct, params);
  const errs = formState.errors.lines;
  const rootError = (errs as { root?: { message?: string }; message?: string } | undefined)?.root?.message ?? (errs as { message?: string } | undefined)?.message;
  const maliyet = kind === "maliyet";

  return (
    <fieldset>
      <legend className="mb-3 text-base font-semibold">{maliyet ? "Görevliler ve maliyet kalemleri (kişi başı, aylık)" : "Müşterinin bugün satın aldığı hizmetler"}</legend>
      {!maliyet && (
        <div className={cn("hidden gap-3 px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted md:grid", GRID)}>
          <span>Hizmet</span>
          <span>Kişi sayısı</span>
          <span>Kişi başı bedel (KDV hariç)</span>
          <span className="text-right">Aylık bedel</span>
          <span />
        </div>
      )}
      <div className="space-y-3">
        {fields.map((f, i) => {
          const e = Array.isArray(errs) ? errs[i] : undefined;
          const row = calc.lines[i];
          const removeBtn = (
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={fields.length <= 1}
              aria-label={`${lines[i]?.service || "Satırı"} kaldır`}
              className="grid h-12 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40 max-md:border max-md:border-border"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          );
          const service = (
            <label className="col-span-2 md:col-span-1">
              <span className={cn("mb-1 block text-xs font-medium text-muted", !maliyet && "md:sr-only")}>{maliyet ? "Görevli / hizmet" : "Hizmet"}</span>
              <input {...register(`lines.${i}.service`)} aria-invalid={e?.service ? true : undefined} placeholder={maliyet ? "Örn. Temizlik Personeli" : "Örn. Güvenlik"} className={big} />
              {e?.service && <span role="alert" className="mt-1 block text-xs text-danger">{e.service.message}</span>}
            </label>
          );
          const people = (
            <label>
              <span className={cn("mb-1 block text-xs font-medium text-muted", !maliyet && "md:sr-only")}>Kişi sayısı</span>
              <input {...register(`lines.${i}.people`)} inputMode="numeric" placeholder="0" aria-invalid={e?.people ? true : undefined} className={cn(big, "text-center")} />
              {e?.people && <span role="alert" className="mt-1 block text-xs text-danger">{e.people.message}</span>}
            </label>
          );
          if (!maliyet) {
            return (
              <div key={f.id} className={cn("grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-2/40 p-3 md:items-start md:border-0 md:bg-transparent md:p-0", GRID)}>
                {service}
                {people}
                <label>
                  <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Kişi başı bedel (KDV hariç)</span>
                  <span className="relative block">
                    <input {...register(`lines.${i}.unit_price`)} inputMode="decimal" placeholder="0" aria-invalid={e?.unit_price ? true : undefined} className={cn(big, "pr-8 text-right")} />
                    <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-muted">₺</span>
                  </span>
                  {e?.unit_price && <span role="alert" className="mt-1 block text-xs text-danger">{e.unit_price.message}</span>}
                </label>
                <p className="col-span-2 flex h-12 items-center justify-between rounded-lg bg-surface px-3 text-sm tabular-nums md:col-span-1 md:justify-end md:bg-transparent md:text-base">
                  <span className="text-xs text-muted md:hidden">Aylık bedel</span>
                  <span className="font-semibold">{row && row.people > 0 ? formatMoney(row.monthly_total) : "—"}</span>
                </p>
                {removeBtn}
              </div>
            );
          }
          const cost = calcCost(lineCost(lines[i] ?? EMPTY_LINE), params, pct);
          return (
            <div key={f.id} className="rounded-xl border border-border bg-surface-2/40 p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_2.75rem] md:items-end">
                {service}
                {people}
                {removeBtn}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {COST_FIELDS.map((k) => (
                  <label key={k}>
                    <span className="mb-1 block text-xs font-medium text-muted">{COST_INPUT_LABELS[k]}{k === "gross" && <span className="text-danger"> *</span>}</span>
                    <span className="relative block">
                      <input {...register(`lines.${i}.${k}`)} inputMode="decimal" placeholder="0" aria-invalid={e?.[k] ? true : undefined} className={cn(control, "h-11 pr-8 text-right text-base")} />
                      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">{k === "ot_hours" ? "sa" : "₺"}</span>
                    </span>
                    {e?.[k] && <span role="alert" className="mt-1 block text-xs text-danger">{e[k]?.message}</span>}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg bg-surface px-3 py-2.5 text-sm tabular-nums">
                <span>Kişi başı bedel: <strong className="text-base">{formatMoney(cost.unit)}</strong> <span className="text-xs text-muted">(kâr payı {formatMoney(cost.profit)} dahil)</span></span>
                <span>Net ele geçen: <strong>{formatMoney(cost.take_home)}</strong></span>
                <span>Aylık bedel: <strong className="text-base">{row && row.people > 0 ? formatMoney(row.monthly_total) : "—"}</strong></span>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-brand">Maliyet analiz tablosunu göster</summary>
                <CostTable title={lines[i]?.service || "Görevli"} cost={cost} className="mt-2" />
              </details>
            </div>
          );
        })}
      </div>
      {rootError && <p role="alert" className="mt-2 text-sm text-danger">{rootError}</p>}
      <button type="button" onClick={() => append({ ...EMPTY_LINE })} disabled={fields.length >= 30} className={btn("secondary", "lg", "mt-3 w-full sm:w-auto")}>
        <Plus className="size-5" aria-hidden /> {maliyet ? "Görevli ekle" : "Hizmet ekle"}
      </button>
      <p className="mt-2 text-xs text-muted">
        {maliyet
          ? "Tutarlar kişi başı ve aylıktır. Kişi başı bedel, maliyet tablosundan (SGK, vergi, yol, giderler ve şirket kâr payı dahil) hesaplanır; oranlar Ayarlar'dan değiştirilir."
          : "Kişi başı bedeli müşterinin son ayki faturasından (KDV hariç) yazın; aylık bedel kendiliğinden hesaplanır. Kuruş için virgül: 58.333,33"}
      </p>
    </fieldset>
  );
}

/** Sağdaki (tablette altta) canlı sonuç: her tuşta yeniden hesaplanır. */
function LiveResult({ kind, params }: { kind: "teklif" | "maliyet"; params: CostParams }) {
  const { control: ctl } = useFormContext<OfferValues>();
  const [lines, vat_rate, fee_per_person, profit_pct] = useWatch({ control: ctl, name: ["lines", "vat_rate", "fee_per_person", "profit_pct"] });
  const { vat, fee, pct } = offerNumbers({ vat_rate: vat_rate ?? "", fee_per_person: fee_per_person ?? "", profit_pct: profit_pct ?? "" });
  return <OfferResult calc={calcOffer(offerLines(lines ?? [], kind), vat, fee, pct, params)} vatRate={vat} fee={fee} profitPct={pct} />;
}

function Submit({ editing }: { editing: boolean }) {
  const { formState } = useFormContext();
  return (
    <button type="submit" disabled={formState.isSubmitting} className={btn("primary", "lg", "w-full text-lg")}>
      {formState.isSubmitting && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {editing ? "Değişiklikleri kaydet" : "Teklifi kaydet"}
    </button>
  );
}

/**
 * Teklif hazırlama (tablet için). `kind`: "teklif" → kişi başı bedel yazılır; "maliyet" → maliyet karşılaştırma:
 * kişi başı bedel maliyet tablosundan hesaplanır. Sonuç yazdıkça güncellenir; kaydedince teklifin sayfası açılır
 * (tutarları sunucu aynı fonksiyonla yeniden hesaplar).
 */
export function OfferForm({ defaults, params }: { defaults: OfferValues; params: CostParams }) {
  const kind = defaults.kind;
  return (
    <Form<OfferValues> schema={offerSchema} defaultValues={defaults} action={saveOffer} resetOnSuccess={false}>
      {/* grid-cols-1 (minmax(0,1fr)): telefonda kutular sütunu içerik genişliğine itip sayfayı yana taşırmasın */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="mb-4 text-base font-semibold">Müşteri</h2>
            <FormGrid>
              <TextField name="customer_name" label="Müşteri / site adı" required large titleCase placeholder="Örn. Yıldız Sitesi Yönetimi" className="sm:col-span-2" />
              <TextField name="contact_name" label="Yetkili" large titleCase placeholder="Ad soyad" />
              <TextField name="phone" label="Telefon" type="tel" inputMode="tel" large placeholder="0532 123 45 67" />
              <TextField name="email" label="E-posta" type="email" inputMode="email" large />
              <DateField name="valid_until" label="Teklif geçerlilik tarihi" />
              <TextField name="address" label="Adres" large className="sm:col-span-2" />
            </FormGrid>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <ServiceRows kind={kind} params={params} />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="mb-4 text-base font-semibold">OPSUYON teklifi ve oranlar</h2>
            <FormGrid cols={3}>
              <TextField name="fee_per_person" label="OPSUYON kişi başı tutar (aylık)" required large inputMode="decimal" suffix="₺" hint="Toplam teklif = toplam kişi × bu tutar" />
              <TextField name="profit_pct" label="Şirket kâr payı" required large inputMode="decimal" suffix="%" hint={kind === "maliyet" ? "Maliyetin üstüne eklenen kâr" : "Kişi başı bedelin içindeki kâr payı"} />
              <TextField name="vat_rate" label="KDV oranı" required large inputMode="decimal" suffix="%" hint="Hizmet faturasındaki KDV" />
              <TextareaField name="notes" label="Not (isteğe bağlı)" rows={2} className="sm:col-span-3" />
            </FormGrid>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <LiveResult kind={kind} params={params} />
          <Submit editing={Boolean(defaults.id)} />
        </div>
      </div>
    </Form>
  );
}
