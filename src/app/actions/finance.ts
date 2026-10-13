"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toNumber } from "@/lib/parse";
import { invoiceSchema, paymentSchema, type InvoiceValues, type PaymentValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const METHODS = ["havale", "eft", "cek", "nakit", "kredi_karti", "diger"];

export async function createInvoice(values: InvoiceValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("finance.manage");
    const v = validate(invoiceSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const subtotal = toNumber(d.subtotal) as number;
    const vat_rate = toNumber(d.vat_rate) as number;
    const vat_amount = round2((subtotal * vat_rate) / 100);

    const supabase = await createClient();
    const { error } = await supabase.from("invoices").insert({
      project_id: d.project_id,
      invoice_no: d.invoice_no,
      issue_date: d.issue_date,
      due_date: nul(d.due_date),
      period_year: toNumber(d.period_year),
      period_month: toNumber(d.period_month),
      subtotal,
      vat_rate,
      vat_amount,
      total: round2(subtotal + vat_amount),
      status: d.status,
      notes: nul(d.notes),
    });
    if (error) {
      if (error.code === "23505") return { error: "Bu fatura numarası projede zaten kayıtlı.", fieldErrors: { invoice_no: "Bu fatura numarası zaten kayıtlı" } };
      return { error: pgMessage(error) };
    }
    revalidatePath(`/projeler/${d.project_id}`, "layout");
    return { ok: true, message: "Fatura kaydedildi." };
  });
}

export async function setInvoiceStatus(fd: FormData): Promise<void> {
  await assertStaff("finance.manage");
  const id = str(fd, "id");
  const project_id = str(fd, "project_id");
  const status = str(fd, "status");
  if (!id || !status || !["draft", "issued", "cancelled"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("invoices").update({ status }).eq("id", id);
  if (project_id) revalidatePath(`/projeler/${project_id}`, "layout");
}

export async function createPayment(values: PaymentValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("finance.manage");
    const v = validate(paymentSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("payments").insert({
      project_id: d.project_id,
      paid_on: d.paid_on,
      amount: toNumber(d.amount),
      invoice_id: nul(d.invoice_id),
      method: METHODS.includes(d.method) ? d.method : null,
      reference: nul(d.reference),
      notes: nul(d.notes),
    });
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/projeler/${d.project_id}`, "layout");
    return { ok: true, message: "Ödeme kaydedildi." };
  });
}

export async function deletePayment(fd: FormData): Promise<void> {
  await assertStaff("finance.manage");
  const id = str(fd, "id");
  const project_id = str(fd, "project_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("payments").delete().eq("id", id);
  if (project_id) revalidatePath(`/projeler/${project_id}`, "layout");
}
