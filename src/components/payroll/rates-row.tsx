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
    net_salary: number; transport_monthly: number; overtime_monthly: number; meal_monthly: number;
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
            <td className={td}>{tl(r.overtime_monthly)}</td>
            <td className={td}>{tl(r.meal_monthly)}</td>
            <td className={td}>
              {tl(r.extra_monthly)}
              {r.extra_label && <span className="block text-[11px] text-muted">{r.extra_label}</span>}
            </td>
          </>
        ) : (
          <td colSpan={5} className="px-4 py-3 text-right">
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
          <td colSpan={7} className="px-4 pb-4">
            <Form<PayRatesValues>
              schema={payRatesSchema}
              defaultValues={{
                personnel_id: row.personnel_id,
                net_salary: money(r?.net_salary),
                transport_monthly: money(r?.transport_monthly),
                overtime_monthly: money(r?.overtime_monthly),
                meal_monthly: money(r?.meal_monthly),
                extra_monthly: money(r?.extra_monthly),
                extra_label: r?.extra_label ?? "",
              }}
              action={savePayRates}
              resetOnSuccess={false}
              onSuccess={() => router.refresh()}
              className="space-y-4 rounded-xl border border-border bg-surface p-4"
            >
              <p className="text-sm font-semibold">{row.full_name} · ücret tanımı (hepsi net)</p>
              <FormGrid cols={6}>
                <TextField name="net_salary" label="Net maaş (aylık)" required inputMode="decimal" suffix="₺" className="sm:col-span-2" />
                <TextField name="transport_monthly" label="Net yol (aylık)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Eksik gün kadar orantılı düşer" />
                <TextField name="overtime_monthly" label="Net fazla mesai (aylık)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Eksik gün kadar orantılı düşer" />
                <TextField name="meal_monthly" label="Yemek kartı (aylık)" inputMode="decimal" suffix="₺" className="sm:col-span-2" hint="Eksik gün kadar orantılı düşer" />
                <TextField name="extra_monthly" label="Ek ödeme (aylık sabit)" inputMode="decimal" suffix="₺" className="sm:col-span-2" />
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
