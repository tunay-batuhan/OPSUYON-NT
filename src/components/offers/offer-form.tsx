"use client";

import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { saveOffer } from "@/app/actions/offers";
import { calcOffer } from "@/lib/offer-calc";
import { offerLines, offerNumbers, offerSchema, type OfferValues } from "@/lib/schemas-offers";
import { formatMoney } from "@/lib/format";
import { Form, FormGrid, TextField, TextareaField, control } from "@/components/forms/form";
import { DateField } from "@/components/forms/date-fields";
import { btn, cn } from "@/components/ui";
import { OfferResult } from "@/components/offers/offer-result";

/** Tablette rahat dokunulan kutu (h-12, büyük yazı). */
const big = cn(control, "h-12 text-base");

/** Müşterinin bugün aldığı hizmetler: hizmet adı, kişi sayısı, aylık KDV hariç tutar → kişi başı bedel. */
function ServiceRows() {
  const { register, control: ctl, formState } = useFormContext<OfferValues>();
  const { fields, append, remove } = useFieldArray({ control: ctl, name: "lines" });
  const lines = useWatch({ control: ctl, name: "lines" }) ?? [];
  const calc = calcOffer(offerLines(lines), 0, 0);
  const errs = formState.errors.lines;
  const rootError = (errs as { root?: { message?: string }; message?: string } | undefined)?.root?.message ?? (errs as { message?: string } | undefined)?.message;

  return (
    <fieldset>
      <legend className="mb-3 text-base font-semibold">Müşterinin bugün satın aldığı hizmetler</legend>
      <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_2.75rem] gap-3 px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted md:grid">
        <span>Hizmet</span>
        <span>Kişi sayısı</span>
        <span>Aylık tutar (KDV hariç)</span>
        <span className="text-right">Kişi başı bedel</span>
        <span />
      </div>
      <div className="space-y-3">
        {fields.map((f, i) => {
          const e = Array.isArray(errs) ? errs[i] : undefined;
          const unit = calc.lines[i]?.unit_price;
          return (
            <div
              key={f.id}
              className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-2/40 p-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_2.75rem] md:items-start md:border-0 md:bg-transparent md:p-0"
            >
              <label className="col-span-2 md:col-span-1">
                <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Hizmet</span>
                <input {...register(`lines.${i}.service`)} aria-invalid={e?.service ? true : undefined} placeholder="Örn. Güvenlik" className={big} />
                {e?.service && <span role="alert" className="mt-1 block text-xs text-danger">{e.service.message}</span>}
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Kişi sayısı</span>
                <input {...register(`lines.${i}.people`)} inputMode="numeric" placeholder="0" aria-invalid={e?.people ? true : undefined} className={cn(big, "text-center")} />
                {e?.people && <span role="alert" className="mt-1 block text-xs text-danger">{e.people.message}</span>}
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Aylık tutar (KDV hariç)</span>
                <span className="relative block">
                  <input {...register(`lines.${i}.monthly_total`)} inputMode="decimal" placeholder="0" aria-invalid={e?.monthly_total ? true : undefined} className={cn(big, "pr-8 text-right")} />
                  <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-muted">₺</span>
                </span>
                {e?.monthly_total && <span role="alert" className="mt-1 block text-xs text-danger">{e.monthly_total.message}</span>}
              </label>
              <p className="flex h-12 items-center justify-between rounded-lg bg-surface px-3 text-sm tabular-nums md:justify-end md:bg-transparent md:text-base">
                <span className="text-xs text-muted md:hidden">Kişi başı</span>
                <span className="font-semibold">{unit === null || unit === undefined ? "—" : formatMoney(unit)}</span>
              </p>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={fields.length <= 1}
                aria-label={`${lines[i]?.service || "Satırı"} kaldır`}
                className="grid h-12 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40 max-md:border max-md:border-border"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      {rootError && <p role="alert" className="mt-2 text-sm text-danger">{rootError}</p>}
      <button
        type="button"
        onClick={() => append({ service: "", people: "", monthly_total: "" })}
        disabled={fields.length >= 30}
        className={btn("secondary", "lg", "mt-3 w-full sm:w-auto")}
      >
        <Plus className="size-5" aria-hidden /> Hizmet ekle
      </button>
      <p className="mt-2 text-xs text-muted">Tutarı müşterinin son ayki faturasından (KDV hariç) yazın; kişi başı bedel kendiliğinden hesaplanır. Kuruş için virgül: 58.333,33</p>
    </fieldset>
  );
}

/** Sağdaki (tablette altta) canlı sonuç: her tuşta yeniden hesaplanır. */
function LiveResult() {
  const { control: ctl } = useFormContext<OfferValues>();
  const [lines, vat_rate, fee_per_person] = useWatch({ control: ctl, name: ["lines", "vat_rate", "fee_per_person"] });
  const { vat, fee } = offerNumbers({ vat_rate: vat_rate ?? "", fee_per_person: fee_per_person ?? "" });
  return <OfferResult calc={calcOffer(offerLines(lines ?? []), vat, fee)} vatRate={vat} fee={fee} />;
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
 * Teklif hazırlama (tablet için): müşteri bilgileri, hizmet satırları, KDV oranı ve kişi başı OPSÜYON tutarı;
 * sonuç tablosu yazdıkça güncellenir. Kaydedince teklifin sayfası açılır (tutarları sunucu aynı fonksiyonla yeniden hesaplar).
 */
export function OfferForm({ defaults }: { defaults: OfferValues }) {
  return (
    <Form<OfferValues> schema={offerSchema} defaultValues={defaults} action={saveOffer} resetOnSuccess={false}>
      {/* grid-cols-1 (minmax(0,1fr)): telefonda kutular sütunu içerik genişliğine itip sayfayı yana taşırmasın */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
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
            <ServiceRows />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="mb-4 text-base font-semibold">OPSÜYON teklifi</h2>
            <FormGrid>
              <TextField name="fee_per_person" label="Kişi başı teklif tutarı (aylık)" required large inputMode="decimal" suffix="₺" hint="Toplam teklif = toplam kişi × bu tutar" />
              <TextField name="vat_rate" label="KDV oranı" required large inputMode="decimal" suffix="%" hint="Müşterinin hizmet faturasındaki KDV" />
              <TextareaField name="notes" label="Not (isteğe bağlı)" rows={2} className="sm:col-span-2" />
            </FormGrid>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <LiveResult />
          <Submit editing={Boolean(defaults.id)} />
        </div>
      </div>
    </Form>
  );
}
