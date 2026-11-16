"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toMoney, toNumber } from "@/lib/parse";
import { calcOffer, isOfferStatus } from "@/lib/offer-calc";
import {
  offerLines, offerNumbers, offerSchema, offerSettingsSchema, serviceList,
  type OfferSettingsValues, type OfferValues,
} from "@/lib/schemas-offers";
import type { ActionState } from "@/lib/action-types";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Teklifi kaydeder (yeni ya da düzenleme). Tutarlar tarayıcıdan alınmaz: sunucu aynı hesap fonksiyonuyla
 * (lib/offer-calc.ts) yeniden hesaplar ve teklifle birlikte saklar. Düzenlemede hizmet satırları baştan yazılır.
 * Kayıttan sonra teklifin sayfasına gider.
 */
export async function saveOffer(values: OfferValues): Promise<ActionState> {
  let id = "";
  const res = await guard(async () => {
    await assertStaff("offers.manage");
    const v = validate(offerSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const lines = offerLines(d.lines).filter((l) => l.service);
    const { vat, fee } = offerNumbers(d);
    const c = calcOffer(lines, vat, fee);

    const row = {
      customer_name: d.customer_name,
      contact_name: nul(d.contact_name),
      phone: nul(d.phone),
      email: nul(d.email),
      address: nul(d.address),
      notes: nul(d.notes),
      vat_rate: vat,
      fee_per_person: fee,
      valid_until: nul(d.valid_until),
      total_people: c.total_people,
      monthly_base: c.monthly_base,
      monthly_vat: c.monthly_vat,
      offer_total: c.offer_total,
      monthly_profit: c.monthly_profit,
      yearly_profit: c.yearly_profit,
    };
    const lineRows = (offerId: string) =>
      c.lines.map((l, i) => ({ offer_id: offerId, service: l.service, people: l.people, monthly_total: l.monthly_total, sort_order: i }));

    const supabase = await createClient();
    if (d.id) {
      const { data: upd, error } = await supabase.from("offers").update(row).eq("id", d.id).select("id").maybeSingle();
      if (error) return { error: pgMessage(error) };
      if (!upd) return { error: "Teklif bulunamadı." };
      const { error: delErr } = await supabase.from("offer_lines").delete().eq("offer_id", d.id);
      if (delErr) return { error: pgMessage(delErr) };
      const { error: insErr } = await supabase.from("offer_lines").insert(lineRows(d.id));
      if (insErr) return { error: `Hizmet satırları kaydedilemedi (${pgMessage(insErr)}). Lütfen yeniden kaydedin.` };
      id = d.id;
    } else {
      const { data: created, error } = await supabase.from("offers").insert({ ...row, status: "draft" }).select("id").single();
      if (error || !created) return { error: pgMessage(error) };
      const { error: insErr } = await supabase.from("offer_lines").insert(lineRows(created.id));
      if (insErr) {
        // satırsız teklif kalmasın
        await supabase.from("offers").delete().eq("id", created.id);
        return { error: pgMessage(insErr) };
      }
      id = created.id;
    }
    revalidatePath("/teklifler");
    revalidatePath(`/teklifler/${id}`);
    return { ok: true, message: "Teklif kaydedildi." };
  });
  if (res?.ok && id) redirect(`/teklifler/${id}`);
  return res;
}

/** Durum: Taslak / Gönderildi / Kabul edildi / Reddedildi (karar tarihi veritabanında dolar). */
export async function setOfferStatus(fd: FormData): Promise<void> {
  await assertStaff("offers.manage");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !UUID.test(id) || !isOfferStatus(status)) return;
  const supabase = await createClient();
  await supabase.from("offers").update({ status }).eq("id", id);
  revalidatePath("/teklifler");
  revalidatePath(`/teklifler/${id}`);
}

export async function deleteOffer(fd: FormData): Promise<void> {
  await assertStaff("offers.manage");
  const id = str(fd, "id");
  if (!id || !UUID.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("offers").delete().eq("id", id);
  if (error) return;
  revalidatePath("/teklifler");
  redirect("/teklifler");
}

/** Yeni tekliflerin varsayılanları: kişi başı tutar, KDV oranı, geçerlilik süresi ve hizmet listesi. */
export async function saveOfferSettings(values: OfferSettingsValues): Promise<ActionState> {
  return guard(async () => {
    const user = await assertStaff("offers.manage");
    const v = validate(offerSettingsSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("offer_settings")
      .update({
        fee_per_person: toMoney(d.fee_per_person) ?? 0,
        vat_rate: toNumber(d.vat_rate) ?? 20,
        validity_days: toNumber(d.validity_days) ?? 30,
        services: serviceList(d.services),
        updated_by: user.id,
      })
      .eq("id", true)
      .select("id")
      .maybeSingle();
    if (error) return { error: pgMessage(error) };
    if (!data) return { error: "Ayarlar kaydedilemedi." };
    revalidatePath("/teklifler", "layout");
    return { ok: true, message: "Varsayılanlar kaydedildi. Yeni tekliflerde kullanılır; mevcut teklifler değişmez." };
  });
}
