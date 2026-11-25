"use client";

import { saveOfferSettings } from "@/app/actions/offers";
import { COST_PARAM_LABELS, COST_RATE_KEYS } from "@/lib/offer-calc";
import { offerSettingsSchema, type OfferSettingsValues } from "@/lib/schemas-offers";
import { CheckboxField, Form, FormGrid, SubmitButton, TextField, TextareaField } from "@/components/forms/form";

/** Yeni tekliflerin varsayılanları ve maliyet tablosu oranları (mevcut teklifler değişmez). */
export function OfferSettingsForm({ defaults }: { defaults: OfferSettingsValues }) {
  return (
    <Form<OfferSettingsValues> schema={offerSettingsSchema} defaultValues={defaults} action={saveOfferSettings} resetOnSuccess={false} className="space-y-5 p-5">
      <FormGrid cols={3}>
        <TextField name="fee_per_person" label="OPSUYON kişi başı tutar (aylık)" required inputMode="decimal" suffix="₺" hint="KDV hariç" />
        <TextField name="params.fee_vat" label="OPSUYON bedeli KDV oranı" required inputMode="decimal" suffix="%" hint="OPSUYON bedeline eklenir" />
        <TextField name="profit_pct" label="Şirket kâr payı" required inputMode="decimal" suffix="%" hint="Teklifte ayrıca değiştirilebilir" />
        <TextField name="vat_rate" label="KDV oranı (hizmet faturası)" required inputMode="decimal" suffix="%" />
        <TextField name="validity_days" label="Teklif geçerlilik süresi" required inputMode="numeric" suffix="gün" />
      </FormGrid>
      <TextareaField
        name="services"
        label="Hizmet satırları"
        rows={5}
        hint="Her satıra bir hizmet adı. Yeni teklif bu satırlarla açılır; teklifte satır eklenip silinebilir."
      />
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Fiyata dahil fonlar</legend>
        <p className="mb-3 text-xs text-muted">Yeni teklifte bu kutular işaretli gelir; her teklifte ayrıca değiştirilebilir. İşaretlenmeyen fon PDF&apos;teki şartlarda “fiyata dahil değildir” olarak yazılır.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-3">
            <CheckboxField name="fund_severance" label="Kıdem tazminatı fonu" />
            <TextField name="params.severance_pct" label="Kıdem fon oranı" required inputMode="decimal" suffix="%" hint="Fonun fiyata yansıyan kısmı (ör. 70)" />
          </div>
          <CheckboxField name="fund_leave" label="Yıllık izin fonu" />
          <CheckboxField name="fund_holiday" label="Resmi tatil mesaisi fonu" />
        </div>
      </fieldset>
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Maliyet tablosu oranları</legend>
        <p className="mb-3 text-xs text-muted">Maliyet karşılaştırma ekranındaki hesap bu oranları kullanır (asgari ücret, SGK, vergi oranları değişince buradan güncelleyin). Kayıtlı teklifler kendi oranlarını korur.</p>
        <FormGrid cols={3}>
          {COST_RATE_KEYS.map((k) => (
            <TextField key={k} name={`params.${k}`} label={COST_PARAM_LABELS[k]} required inputMode="decimal" />
          ))}
        </FormGrid>
      </fieldset>
      <SubmitButton>Varsayılanları kaydet</SubmitButton>
    </Form>
  );
}
