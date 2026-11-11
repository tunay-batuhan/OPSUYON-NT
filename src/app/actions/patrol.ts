"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guard, pgMessage, str, validate } from "@/lib/form";
import { newPatrolPin, newPointCode, normalizeCode } from "@/lib/patrol";
import { toTitleCase } from "@/lib/format";
import { patrolPointsBulkSchema, type PatrolPointsBulkValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

export type PinResult = { ok: true; people: { id: string; name: string }[] } | { ok: false; error: string };

const cleanCode = (raw: unknown) => normalizeCode(String(raw ?? "")).slice(0, 40);
const validCode = (code: string) => /^[A-Z0-9-]{6,32}$/.test(code);
const validPin = (pin: string) => /^[0-9]{4}$/.test(pin);

/**
 * Herkese açık okutma sayfası (/d/<kod>): devriye BAŞLATILIRKEN sorulan proje PIN'i (tur işlemleri: patrol-tour.ts). Doğruysa projede bugün çalışan
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

/** Merkez: projeye yeni 4 haneli devriye PIN'i verir (varsa eskisi geçersiz olur). Görevli bu PIN'i devriyeyi başlatırken girer. */
export async function generateProjectPin(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "project_id");
  if (!id) return;
  const pin = newPatrolPin();
  const supabase = await createClient();
  await supabase.from("patrol_pins").upsert({ project_id: id, pin }, { onConflict: "project_id" });
  revalidatePath("/devriye", "layout");
}

/** Merkez: projenin PIN'ini kaldırır; PIN yokken o projede devriye başlatılamaz (PIN yalnızca başlat/bitir QR'ında sorulur). */
export async function removeProjectPin(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "project_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("patrol_pins").delete().eq("project_id", id);
  revalidatePath("/devriye", "layout");
}

// "a blok girişi" → "A Blok Girişi" (kısaltmalar korunur)
const clean = (s: string) => toTitleCase(s);
const key = (s: string) => clean(s).toLocaleLowerCase("tr");

type Supa = Awaited<ReturnType<typeof createClient>>;
type PointInfo = { project_id: string; kind: "nokta" | "tur" };
/** Noktanın projesi ve türü. "tur" = projenin "Devriye başlat / bitir" etiketi: silinmez, pasife alınmaz, adı ve sırası değişmez. */
async function pointInfo(supabase: Supa, id: string): Promise<PointInfo | null> {
  const { data } = await supabase.from("patrol_points").select("project_id, kind").eq("id", id).maybeSingle();
  return (data as PointInfo | null) ?? null;
}

/**
 * Merkez: projeye bir veya birden çok nokta ekler (her satır bir nokta adı). Barkod/QR içeriği otomatik üretilir.
 * Projede aynı adda nokta varsa o satır atlanır.
 */
export async function addPatrolPoints(values: PatrolPointsBulkValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("patrol.manage");
    const v = validate(patrolPointsBulkSchema, values);
    if (!v.ok) return v.state;
    const { project_id } = v.data;

    const supabase = await createClient();
    const { data: existing } = await supabase.from("patrol_points").select("name, sort_order").eq("project_id", project_id);
    const taken = new Set((existing ?? []).map((p) => key(p.name as string)));
    let sort = Math.max(0, ...(existing ?? []).map((p) => p.sort_order as number));

    const skipped: string[] = [];
    const names: string[] = [];
    for (const line of v.data.names.split(/\r?\n/)) {
      const name = clean(line);
      if (!name) continue;
      if (taken.has(key(name))) {
        skipped.push(name);
        continue;
      }
      taken.add(key(name));
      names.push(name);
    }
    if (names.length === 0) return { error: "Yazdığınız adların hepsi bu projede zaten var.", fieldErrors: { names: "Bu adlarda nokta zaten var" } };

    for (let attempt = 0; attempt < 4; attempt++) {
      const rows = names.map((name, i) => ({ project_id, name, code: newPointCode(), sort_order: sort + (i + 1) * 10 }));
      const { error } = await supabase.from("patrol_points").insert(rows);
      if (!error) {
        sort += names.length * 10;
        revalidatePath("/devriye", "layout");
        const added = names.length === 1 ? `“${names[0]}” eklendi.` : `${names.length} nokta eklendi.`;
        return { ok: true, message: skipped.length ? `${added} Zaten olduğu için atlananlar: ${skipped.join(", ")}` : `${added} Etiketlerini yazdırabilirsiniz.` };
      }
      if (error.code !== "23505") return { error: pgMessage(error) };
    }
    return { error: "Barkod üretilemedi, lütfen tekrar deneyin." };
  });
}

/** Merkez: noktanın adını değiştirir (QR kodu aynı kalır, etiketi yeniden yazdırmak gerekmez ama etiketteki ad eskir). */
export async function renamePatrolPoint(id: string, rawName: string): Promise<{ ok: true } | { error: string }> {
  try {
    await assertStaff("patrol.manage");
  } catch {
    return { error: "Bu işlem için yetkiniz yok." };
  }
  const name = clean(String(rawName ?? ""));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Nokta bulunamadı." };
  if (name.length < 2 || name.length > 80) return { error: "Nokta adı 2–80 karakter olmalı." };
  const supabase = await createClient();
  const point = await pointInfo(supabase, id);
  if (!point) return { error: "Nokta bulunamadı." };
  if (point.kind === "tur") return { error: "“Devriye başlat / bitir” etiketinin adı değiştirilemez." };
  const { data: same } = await supabase.from("patrol_points").select("id, name").eq("project_id", point.project_id).neq("id", id);
  if ((same ?? []).some((p) => key(p.name as string) === key(name))) return { error: "Bu projede aynı adda başka bir nokta var." };
  const { error } = await supabase.from("patrol_points").update({ name }).eq("id", id);
  if (error) return { error: pgMessage(error) };
  revalidatePath("/devriye", "layout");
  return { ok: true };
}

/** Merkez: noktayı listede bir üste / alta taşır (etiket ve rapor sırası). */
export async function movePatrolPoint(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  const dir = fd.get("dir") === "up" ? -1 : 1;
  if (!id) return;
  const supabase = await createClient();
  const point = await pointInfo(supabase, id);
  if (!point || point.kind === "tur") return;
  // yalnızca kontrol noktaları sıralanır; başlat/bitir etiketi (sort_order -1) dokunulmadan kalır
  const { data } = await supabase.from("patrol_points").select("id, sort_order").eq("project_id", point.project_id).eq("kind", "nokta").order("sort_order").order("name").order("id");
  const list = (data ?? []).map((p) => p.id as string);
  const i = list.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  // sıra 10, 20, 30… olarak yeniden yazılır (yalnızca değişenler)
  const current = new Map((data ?? []).map((p) => [p.id as string, p.sort_order as number]));
  await Promise.all(
    list.map((pid, k) => ((k + 1) * 10 !== current.get(pid) ? supabase.from("patrol_points").update({ sort_order: (k + 1) * 10 }).eq("id", pid) : null)),
  );
  revalidatePath("/devriye", "layout");
}

/** Okutma kaydı olmayan nokta silinir; kaydı olan nokta rapor geçmişi bozulmasın diye pasife alınır. */
export async function removePatrolPoint(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  const point = await pointInfo(supabase, id);
  if (!point || point.kind === "tur") return;
  const { count } = await supabase.from("patrol_scans").select("id", { count: "exact", head: true }).eq("point_id", id);
  if ((count ?? 0) > 0) await supabase.from("patrol_points").update({ is_active: false }).eq("id", id);
  else await supabase.from("patrol_points").delete().eq("id", id);
  revalidatePath("/devriye", "layout");
}

/** Merkez: noktanın konumunu siler; noktadaki bir sonraki isabetli (≤ 50 m) okutmadan yeniden öğrenilir. */
export async function resetPatrolPointLocation(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("patrol_points").update({ lat: null, lng: null }).eq("id", id);
  revalidatePath("/devriye", "layout");
}

/** Merkez: noktayı pasife alır / yeniden aktifleştirir. Başlat/bitir etiketi pasife alınamaz (aktifleştirmek serbest). */
export async function setPatrolPointActive(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  if (!id) return;
  const active = fd.get("active") === "1";
  const supabase = await createClient();
  const point = await pointInfo(supabase, id);
  if (!point || (point.kind === "tur" && !active)) return;
  await supabase.from("patrol_points").update({ is_active: active }).eq("id", id);
  revalidatePath("/devriye", "layout");
}
