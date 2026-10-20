"use server";

import { revalidatePath } from "next/cache";
import { assertStaff, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, pgMessage, str, validate } from "@/lib/form";
import { newPointCode, normalizeCode } from "@/lib/patrol";
import { patrolPointSchema, type PatrolPointValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

export type ScanResult =
  | { ok: true; point: string; project: string; scannedAt: string; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Devriye görevlisinin telefonundan okuttuğu barkod/QR. Yetki ve kayıt veritabanı fonksiyonunda
 * (record_patrol_scan) denetlenir: kod tanınmalı ve kişinin o projede "patrol.scan" izni olmalı.
 */
export async function recordPatrolScan(rawCode: string): Promise<ScanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Oturum süresi dolmuş. Lütfen yeniden giriş yapın." };
  const code = normalizeCode(String(rawCode ?? "")).slice(0, 40);
  if (code.length < 4) return { ok: false, error: "Barkod okunamadı. Tekrar deneyin." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_patrol_scan", { p_code: code });
  if (error) return { ok: false, error: error.message || pgMessage(error) };
  const r = data as { point: string; project: string; scanned_at: string; duplicate: boolean };
  revalidatePath("/devriye/okut");
  return { ok: true, point: r.point, project: r.project, scannedAt: r.scanned_at, duplicate: Boolean(r.duplicate) };
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

export async function setPatrolPointActive(fd: FormData): Promise<void> {
  await assertStaff("patrol.manage");
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("patrol_points").update({ is_active: fd.get("active") === "1" }).eq("id", id);
  revalidatePath("/devriye/noktalar");
}
