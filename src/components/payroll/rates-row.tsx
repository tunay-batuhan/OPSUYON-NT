"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { savePayRates } from "@/app/actions/payroll";
import { payRatesSchema, type PayRatesValues } from "@/lib/schemas-payroll";
import { tl } from "@/lib/payroll-shared";
import { Form, FormGrid, SubmitButton, TextField } from "@/components/forms/form";
import { btn, cn } from "@/components/ui";

export type RatesRowData = {
  personnel_id: string;
  full_name: string;
  title: string | null;
  project: string;
  rates: {
    net_salary: number; transport_monthly: number; support_monthly: number; overtime_monthly: number; meal_monthly: number; bes_monthly: number;
    extra_monthly: number; extra_label: string | null; updated_at: string;
  } | null;
};

const td = "whitespace-nowrap px-4 py-3 text-right tabular-nums";
/** Kutuya yazılacak Türkçe tutar: 28075.5 → "28075,50"; 0 → "" */
const money = (n: number | undefined) => (n ? n.toFixed(2).replace(".", ",") : "");

/**
 * Ücret tanımları tablosunun satırı. Merkez (payroll.manage) "Düzenle" ile satırın altında formu açar;
 * müşteri yalnızca görür.
 */
export function RatesRow({ row, editable }: { row: RatesRowData; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const r = row.rates;
  return (
    <>
      <tr className={cn(open && "bg-brand-soft/40")}>
        <td className="px-4 py-3">
          <p className="font-medium">{row.full_name}</p>
          <p className="text-xs text-muted">{[row.title, row.project].filter(Boolean).join(" · ")}</p>
        </td>
        {r ? (
          <>
            <td className={cn(td, "font-semibold")}>{tl(r.net_salary)}</td>
            <td className={td}>{tl(r.transport_monthly)}</td>
            <td className={td}>{tl(r.support_monthly)}</td>
            <td className={td}>{tl(r.meal_monthly)}</td>
            <td className={td}>{tl(r.overtime_monthly)}</td>
            <td className={td}>
              {tl(r.extra_monthly)}
              {r.extra_label && <span className="block text-[11px] text-muted">{r.extra_label}</span>}
            </td>
            <td className={td}>{tl(r.bes_monthly)}</td>
          </>
        ) : (
          <td colSpan={7} className="px-4 py-3 text-right">
            <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">Ücret tanımı yok</span>
          </td>
        )}
        {editable && (
          <td className="px-4 py-3 text-right">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={btn("secondary", "sm")}>
              {open ? <X className="size-4" aria-hidden /> : <Pencil className="size-4" aria-hidden />}
              {open ? "Kapat" : r ? "Düzenle" : "Tanımla"}
            </button>
          </td>
        )}
      </tr>
      {editable && open && (
        <tr className="bg-brand-soft/20">
          <td colSpan={9} className="px-4 pb-4">
            <Form<PayRatesValues>
              schema={payRatesSchema}
              defaultValues={{
                personnel_id: row.personnel_id,
                net_salary: money(r?.net_salary),
                transport_monthly: money(r?.transport_monthly),
                support_monthly: money(r?.support_monthly),
                overtime_monthly: money(r?.overtime_monthly),
                meal_monthly: money(r?.meal_monthly),
                bes_monthly: money(r?.bes_monthly),
                extra_monthly: money(r?.extra_monthly),
                extra_label: r?.extra_label ?? "",
              }}
              action={savePayRates}
              resetOnSuccess={false}
              onSuccess={() => router.refresh()}
              className="space-y-4 rounded-xl border border-border bg-surface p-4"
            >
              <p className="text-sm font-semibold">{row.full_name} · ücret tanımı (hepsi net, aylık). Bordro formülleri bu değerleri kullanır.</p>
              <FormGrid cols={6}>
                <TextField name="net_salary" label="Net maaş (aylık)" required inputMode="decimal" suffix="₺" className="sm:col-span-2" />
                <TextField name="transport_monthly" label="Net yol (aylık)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Formüllerde: tanim_yol" />
                <TextField name="support_monthly" label="Destek ödeme (aylık)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Formüllerde: tanim_destek" />
                <TextField name="meal_monthly" label="Ticket / yemek kartı (aylık)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Formüllerde: tanim_ticket" />
                <TextField name="overtime_monthly" label="Net fazla mesai (aylık)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Formüllerde: tanim_fazla_mesai" />
                <TextField name="bes_monthly" label="BES (aylık kesinti)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Formüllerde: tanim_bes" />
                <TextField name="extra_monthly" label="Ek ödeme (aylık sabit)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Örn. emekli vergi; formüllerde: tanim_ek" />
                <TextField name="extra_label" label="Ek ödemenin adı" placeholder="Örn. Emekli farkı" maxLength={60} className="sm:col-span-2" />
              </FormGrid>
              <SubmitButton>Kaydet</SubmitButton>
            </Form>
          </td>
        </tr>
      )}
    </>
  );
}
