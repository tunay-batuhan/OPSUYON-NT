"use client";

import { saveOfferSettings } from "@/app/actions/offers";
import { COST_PARAM_LABELS, type CostParams } from "@/lib/offer-calc";
import { offerSettingsSchema, type OfferSettingsValues } from "@/lib/schemas-offers";
import { Form, FormGrid, SubmitButton, TextField, TextareaField } from "@/components/forms/form";

/** Yeni tekliflerin varsayılanları ve maliyet tablosu oranları (mevcut teklifler değişmez). */
export function OfferSettingsForm({ defaults }: { defaults: OfferSettingsValues }) {
  return (
    <Form<OfferSettingsValues> schema={offerSettingsSchema} defaultValues={defaults} action={saveOfferSettings} resetOnSuccess={false} className="space-y-5 p-5">
      <FormGrid cols={3}>
        <TextField name="fee_per_person" label="OPSUYON kişi başı tutar (aylık)" required inputMode="decimal" suffix="₺" />
        <TextField name="profit_pct" label="Şirket kâr payı" required inputMode="decimal" suffix="%" hint="Teklifte ayrıca değiştirilebilir" />
        <TextField name="vat_rate" label="KDV oranı" required inputMode="decimal" suffix="%" />
        <TextField name="validity_days" label="Teklif geçerlilik süresi" required inputMode="numeric" suffix="gün" />
      </FormGrid>
      <TextareaField
        name="services"
        label="Hizmet satırları"
        rows={5}
        hint="Her satıra bir hizmet adı. Yeni teklif bu satırlarla açılır; teklifte satır eklenip silinebilir."
      />
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Maliyet tablosu oranları</legend>
        <p className="mb-3 text-xs text-muted">Maliyet karşılaştırma ekranındaki hesap bu oranları kullanır (asgari ücret, SGK, vergi oranları değişince buradan güncelleyin). Kayıtlı teklifler kendi oranlarını korur.</p>
        <FormGrid cols={3}>
          {(Object.keys(COST_PARAM_LABELS) as (keyof CostParams)[]).map((k) => (
            <TextField key={k} name={`params.${k}`} label={COST_PARAM_LABELS[k]} required inputMode="decimal" />
          ))}
        </FormGrid>
      </fieldset>
      <SubmitButton>Varsayılanları kaydet</SubmitButton>
    </Form>
  );
}
