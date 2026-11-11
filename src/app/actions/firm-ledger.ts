"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toNumber } from "@/lib/parse";
import { formatMoney } from "@/lib/format";
import { ledgerEntrySchema, type LedgerEntryValues } from "@/lib/schemas-ledger";
import type { ActionState } from "@/lib/action-types";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Firma bazlı cari hesaba fatura ya da tahsilat girer (Cari Hesap → Fatura girişi / Tahsilat girişi).
 * Firmanın bakiyesi = tüm faturalar − tüm tahsilatlar.
 */
export async function createFirmLedgerEntry(values: LedgerEntryValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("finance.manage");
    const kind = values?.kind === "tahsilat" ? "tahsilat" : "fatura";
    const v = validate(ledgerEntrySchema(kind), values);
    if (!v.ok) return v.state;
    const d = v.data;
    const amount = Math.round((toNumber(d.amount) ?? 0) * 100) / 100;
    if (amount <= 0) return { error: "Tutar sıfırdan büyük olmalı.", fieldErrors: { amount: "Tutar sıfırdan büyük olmalı" } };

    const supabase = await createClient();
    // yalnızca arşivlenmemiş firmalara giriş yapılır
    const { data: org } = await supabase.from("organizations").select("name, status").eq("id", d.organization_id).maybeSingle();
    if (!org || org.status !== "active") return { error: "Firma bulunamadı veya arşivde.", fieldErrors: { organization_id: "Aktif bir firma seçin" } };

    const { error } = await supabase.from("firm_ledger_entries").insert({
      organization_id: d.organization_id,
      kind,
      entry_date: d.entry_date,
      entry_time: d.entry_time,
      description: nul(d.description),
      amount,
      created_by: actor.id,
    });
    if (error) return { error: pgMessage(error) };

    revalidatePath("/cari-hesap", "layout");
    return { ok: true, message: `${org.name}: ${kind === "fatura" ? "fatura" : "tahsilat"} kaydedildi (${formatMoney(amount)}).` };
  });
}

/** Cari hareketi (fatura / tahsilat) kalıcı siler; firmanın bakiyesi buna göre değişir. */
export async function deleteFirmLedgerEntry(fd: FormData): Promise<void> {
  await assertStaff("finance.manage");
  const id = str(fd, "id");
  if (!id || !UUID.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("firm_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(pgMessage(error));
  revalidatePath("/cari-hesap", "layout");
}
