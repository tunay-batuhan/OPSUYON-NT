"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublicKey } from "@/lib/supabase/env";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toMoney, toNumber } from "@/lib/parse";
import { calcOffer, isOfferStatus } from "@/lib/offer-calc";
import {
  LETTERHEAD_MAX, letterheadKind, letterheadMarginsSchema, offerLines, offerNumbers, offerSchema, offerSettingsSchema, serviceList,
  type LetterheadMarginsValues, type OfferSettingsValues, type OfferValues,
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

/* ------------------------------------------------------------------ */
/* Antetli kağıt (teklif PDF'inin zemini)                              */
/* ------------------------------------------------------------------ */
const BUCKET = "documents";
const LETTERHEAD_PATH = /^offers\/letterhead\/[0-9a-f-]{36}\.(pdf|png|jpg)$/;

export type PreparedLetterhead = { path: string; signedUrl: string; anonKey: string } | { error: string };

/** Antet dosyası için imzalı yükleme adresi (dosya tarayıcıdan doğrudan Storage'a gider). */
export async function prepareLetterheadUpload(input: { fileName: string; mime?: string; size: number }): Promise<PreparedLetterhead> {
  try {
    await assertStaff("offers.manage");
    const kind = letterheadKind(input.fileName, input.mime);
    if (!kind) return { error: "Antet PDF, PNG ya da JPG olmalı." };
    if (!(input.size > 0 && input.size <= LETTERHEAD_MAX)) return { error: "Antet dosyası 10 MB'tan büyük olamaz." };
    const path = `offers/letterhead/${randomUUID()}.${kind.ext}`;
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? "Yükleme hazırlanamadı." };
    return { path, signedUrl: data.signedUrl, anonKey: supabasePublicKey() };
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : "Yükleme hazırlanamadı." };
  }
}

/**
 * Yüklenen anteti doğrular (PDF açılabiliyor / görsel gömülebiliyor mu) ve ayarlara bağlar; eski antet dosyası silinir.
 * Okunamayan dosya Storage'dan kaldırılır.
 */
export async function saveLetterhead(input: { path: string; fileName: string }): Promise<ActionState> {
  return guard(async () => {
    const user = await assertStaff("offers.manage");
    const m = input.path.match(LETTERHEAD_PATH);
    if (!m) return { error: "Geçersiz dosya yolu." };
    const mime = m[1] === "pdf" ? "application/pdf" : m[1] === "png" ? "image/png" : "image/jpeg";
    const admin = createAdminClient(user.id);
    const drop = async (message: string) => {
      await admin.storage.from(BUCKET).remove([input.path]);
      return { error: message };
    };
    const { data: blob } = await admin.storage.from(BUCKET).download(input.path);
    if (!blob) return { error: "Yüklenen dosya bulunamadı; yeniden deneyin." };
    if (blob.size > LETTERHEAD_MAX) return drop("Antet dosyası 10 MB'tan büyük olamaz.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    try {
      if (mime === "application/pdf") {
        const src = await PDFDocument.load(bytes);
        if (src.getPageCount() < 1) return drop("PDF'te sayfa yok.");
        await (await PDFDocument.create()).embedPdf(bytes, [0]);
      } else {
        const probe = await PDFDocument.create();
        if (mime === "image/png") await probe.embedPng(bytes);
        else await probe.embedJpg(bytes);
      }
    } catch {
      return drop("Dosya okunamadı. Şifresiz bir PDF ya da PNG/JPG yükleyin.");
    }

    const supabase = await createClient();
    const { data: old } = await supabase.from("offer_settings").select("letterhead_path").eq("id", true).maybeSingle();
    const { data, error } = await supabase
      .from("offer_settings")
      .update({ letterhead_path: input.path, letterhead_name: input.fileName.slice(0, 255) || `antet.${m[1]}`, letterhead_mime: mime, updated_by: user.id })
      .eq("id", true)
      .select("id")
      .maybeSingle();
    if (error || !data) return drop(error ? pgMessage(error) : "Ayar kaydedilemedi.");
    const oldPath = old?.letterhead_path as string | null | undefined;
    if (oldPath && oldPath !== input.path) await admin.storage.from(BUCKET).remove([oldPath]);
    revalidatePath("/teklifler", "layout");
    return { ok: true, message: "Antet kaydedildi. Bundan sonra açılan her teklif PDF'i bu antetle çıkar." };
  });
}

/** Anteti kaldırır: teklif PDF'leri yeniden OPSUYON logolu başlıkla çıkar. */
export async function removeLetterhead(): Promise<void> {
  const user = await assertStaff("offers.manage");
  const supabase = await createClient();
  const { data: old } = await supabase.from("offer_settings").select("letterhead_path").eq("id", true).maybeSingle();
  const { error } = await supabase
    .from("offer_settings")
    .update({ letterhead_path: null, letterhead_name: null, letterhead_mime: null, updated_by: user.id })
    .eq("id", true);
  if (!error && old?.letterhead_path) await createAdminClient(user.id).storage.from(BUCKET).remove([old.letterhead_path as string]);
  revalidatePath("/teklifler", "layout");
}

/** Antetin üst / alt boşluğu (mm). */
export async function saveLetterheadMargins(values: LetterheadMarginsValues): Promise<ActionState> {
  return guard(async () => {
    const user = await assertStaff("offers.manage");
    const v = validate(letterheadMarginsSchema, values);
    if (!v.ok) return v.state;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("offer_settings")
      .update({ letterhead_top_mm: toNumber(v.data.top_mm) ?? 45, letterhead_bottom_mm: toNumber(v.data.bottom_mm) ?? 25, updated_by: user.id })
      .eq("id", true)
      .select("id")
      .maybeSingle();
    if (error) return { error: pgMessage(error) };
    if (!data) return { error: "Ayar kaydedilemedi." };
    revalidatePath("/teklifler", "layout");
    return { ok: true, message: "Boşluklar kaydedildi. Örnek PDF ile kontrol edebilirsiniz." };
  });
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
