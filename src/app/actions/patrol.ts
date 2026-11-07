"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guard, pgMessage, str, validate } from "@/lib/form";
import { newPatrolPin, newPointCode, normalizeCode } from "@/lib/patrol";
import { patrolPointSchema, type PatrolPointValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

export type ScanResult =
  | { ok: true; point: string; project: string; person: string; scannedAt: string; duplicate: boolean }
  | { ok: false; error: string };

export type PinResult = { ok: true; people: { id: string; name: string }[] } | { ok: false; error: string };

export type ScanLocation = { lat: number; lng: number; accuracy: number | null } | null;

const cleanCode = (raw: unknown) => normalizeCode(String(raw ?? "")).slice(0, 40);
const validCode = (code: string) => /^[A-Z0-9-]{6,32}$/.test(code);
const validPin = (pin: string) => /^[0-9]{4}$/.test(pin);

/**
 * Herkese açık okutma sayfası (/d/<kod>), 1. adım: projenin 4 haneli PIN'i. Doğruysa projede bugün çalışan
 * personel listesi döner (adlar PIN'den önce gösterilmez). Bir noktada 10 dk içinde 5 hatalı PIN olursa nokta kilitlenir.
 */
export async function checkPatrolPin(rawCode: string, rawPin: string): Promise<PinResult> {
  const code = cleanCode(rawCode);
  const pin = String(rawPin ?? "").trim();
  if (!validCode(code)) return { ok: false, error: "Bu QR kodu tanınmadı." };
  if (!validPin(pin)) return { ok: false, error: "PIN 4 haneli olmalı." };
  const { data, error } = await createAdminClient().rpc("patrol_check_pin", { p_code: code, p_pin: pin });
  if (error) return { ok: false, error: "Bağlantı hatası. Tekrar deneyin." };
  const r = data as { ok: boolean; error?: string; people?: { id: string; name: string }[] };
  return r.ok ? { ok: true, people: r.people ?? [] } : { ok: false, error: r.error ?? "PIN doğrulanamadı." };
}

/**
 * 2. adım: görevli listeden adını seçer, okutma kaydedilir. PIN ve kişinin bu projede çalıştığı veritabanında
 * yeniden denetlenir (record_patrol_scan_pin). Saat sunucudan alınır; telefonun saati kayda etki etmez.
 */
export async function submitPatrolScan(rawCode: string, rawPin: string, personnelId: string, loc: ScanLocation): Promise<ScanResult> {
  const code = cleanCode(rawCode);
  const pin = String(rawPin ?? "").trim();
  if (!validCode(code)) return { ok: false, error: "Bu QR kodu tanınmadı." };
  if (!validPin(pin)) return { ok: false, error: "PIN 4 haneli olmalı." };
  if (!/^[0-9a-f-]{36}$/i.test(String(personnelId ?? ""))) return { ok: false, error: "Listeden adınızı seçin." };

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const lat = num(loc?.lat);
  const lng = num(loc?.lng);
  const hasLoc = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const { data, error } = await createAdminClient().rpc("record_patrol_scan_pin", {
    p_code: code,
    p_pin: pin,
    p_personnel_id: personnelId,
    p_lat: hasLoc ? lat : null,
    p_lng: hasLoc ? lng : null,
    p_accuracy: hasLoc ? num(loc?.accuracy) : null,
  });
  if (error) return { ok: false, error: "Kayıt yapılamadı. Bağlantınızı kontrol edip tekrar deneyin." };
  const r = data as { ok: boolean; error?: string; point: string; project: string; person: string; scanned_at: string; duplicate: boolean };
  if (!r.ok) return { ok: false, error: r.error ?? "Kayıt yapılamadı." };
  return { ok: true, point: r.point, project: r.project, person: r.person, scannedAt: r.scanned_at, duplicate: Boolean(r.duplicate) };
}

/** Merkez: projeye yeni 4 haneli devriye PIN'i verir (varsa eskisi geçersiz olur). */
export async function generateProjectPin(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "project_id");
  if (!id) return;
  const pin = newPatrolPin();
  const supabase = await createClient();
  await supabase.from("patrol_pins").upsert({ project_id: id, pin }, { onConflict: "project_id" });
  revalidatePath("/devriye/pinler");
}

/** Merkez: projenin PIN'ini kaldırır; PIN yokken o projede okutma yapılamaz. */
export async function removeProjectPin(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "project_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("patrol_pins").delete().eq("project_id", id);
  revalidatePath("/devriye/pinler");
}

/** Merkez: projeye yeni devriye noktası ekler; barkod içeriği otomatik üretilir. */
export async function createPatrolPoint(values: PatrolPointValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("patrol.manage");
    const v = validate(patrolPointSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { data: last } = await supabase.from("patrol_points").select("sort_order").eq("project_id", d.project_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const sort = ((last?.sort_order as number | undefined) ?? 0) + 10;

    for (let attempt = 0; attempt < 4; attempt++) {
      const { error } = await supabase.from("patrol_points").insert({ project_id: d.project_id, name: d.name, code: newPointCode(), sort_order: sort });
      if (!error) {
        revalidatePath("/devriye/noktalar");
        return { ok: true, message: "Nokta eklendi. Barkod etiketini yazdırabilirsiniz." };
      }
      if (error.code !== "23505") return { error: pgMessage(error) };
    }
    return { error: "Barkod üretilemedi, lütfen tekrar deneyin." };
  });
}

/** Okutma kaydı olmayan nokta silinir; kaydı olan nokta rapor geçmişi bozulmasın diye pasife alınır. */
export async function removePatrolPoint(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  const { count } = await supabase.from("patrol_scans").select("id", { count: "exact", head: true }).eq("point_id", id);
  if ((count ?? 0) > 0) await supabase.from("patrol_points").update({ is_active: false }).eq("id", id);
  else await supabase.from("patrol_points").delete().eq("id", id);
  revalidatePath("/devriye/noktalar");
}

/** Merkez: noktanın konumunu siler; noktadaki bir sonraki isabetli (≤ 50 m) okutmadan yeniden öğrenilir. */
export async function resetPatrolPointLocation(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("patrol_points").update({ lat: null, lng: null }).eq("id", id);
  revalidatePath("/devriye/noktalar");
}

export async function setPatrolPointActive(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("patrol_points").update({ is_active: fd.get("active") === "1" }).eq("id", id);
  revalidatePath("/devriye/noktalar");
}
