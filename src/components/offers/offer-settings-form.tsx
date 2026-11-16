"use client";

import { saveOfferSettings } from "@/app/actions/offers";
import { offerSettingsSchema, type OfferSettingsValues } from "@/lib/schemas-offers";
import { Form, FormGrid, SubmitButton, TextField, TextareaField } from "@/components/forms/form";

/** Yeni tekliflerin varsayılanları (mevcut teklifler değişmez). */
export function OfferSettingsForm({ defaults }: { defaults: OfferSettingsValues }) {
  return (
    <Form<OfferSettingsValues> schema={offerSettingsSchema} defaultValues={defaults} action={saveOfferSettings} resetOnSuccess={false} className="space-y-5 p-5">
      <FormGrid cols={3}>
        <TextField name="fee_per_person" label="Kişi başı teklif tutarı (aylık)" required inputMode="decimal" suffix="₺" />
        <TextField name="vat_rate" label="KDV oranı" required inputMode="decimal" suffix="%" />
        <TextField name="validity_days" label="Teklif geçerlilik süresi" required inputMode="numeric" suffix="gün" />
      </FormGrid>
      <TextareaField
        name="services"
        label="Hizmet satırları"
        rows={6}
        hint="Her satıra bir hizmet adı. Yeni teklif bu satırlarla açılır; teklifte satır eklenip silinebilir."
      />
      <SubmitButton>Varsayılanları kaydet</SubmitButton>
    </Form>
  );
}
