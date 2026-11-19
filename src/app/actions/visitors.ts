"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { guard, nul, pgMessage } from "@/lib/form";
import { toTitleCase } from "@/lib/format";
import { isUuid } from "@/lib/lookups";
import { canRecordOn } from "@/lib/visitors";
import { normalizePlate, ownDeleteSince, type Approval } from "@/lib/visitor-shared";
import { cargoSchema, firstErrors, visitorSchema, type CargoValues, type VisitorValues } from "@/lib/schemas-visitors";
import type { ActionState } from "@/lib/action-types";

/**
 * Ziyaretçi / kargo kayıtları. Yazma servis istemcisiyle yapılır; önce kullanıcının o projede kayıt girebildiği
 * denetlenir (güvenlik personeli: projede aktif görevli; panel: visitors.record). Kaydeden kişi kayda yazılır.
 */
function refresh() {
  revalidatePath("/ziyaretci-defteri");
  revalidatePath("/ziyaretciler");
}

const who = (user: CurrentUser) => ({
  created_by: user.id,
  personnel_id: user.kind === "personnel" ? user.personnel_id : null,
});

export async function recordVisitor(values: VisitorValues): Promise<ActionState> {
  return guard(async () => {
    const user = await getCurrentUser();
    const v = visitorSchema.safeParse(values);
    if (!v.success) {
      const e = firstErrors(v.error);
      return { error: e.message, fieldErrors: e.fields };
    }
    const d = v.data;
    if (!user || !(await canRecordOn(user, d.project_id))) return { error: "Bu projede kayıt girme yetkiniz yok." };
    const { error } = await createAdminClient(user.id).from("visitor_logs").insert({
      project_id: d.project_id,
      kind: "ziyaretci",
      full_name: toTitleCase(d.full_name),
      phone: nul(d.phone),
      plate: d.plate ? normalizePlate(d.plate) || null : null,
      destination: d.destination.trim(),
      approval: d.approval,
      note: nul(d.note),
      ...who(user),
    });
    if (error) return { error: pgMessage(error) };
    refresh();
    const msg = d.approval === "onaylandi" ? "giriş yaptı" : d.approval === "reddedildi" ? "reddedildi (içeri alınmadı)" : "kaydedildi, sakin onayı bekleniyor";
    return { ok: true, message: `${toTitleCase(d.full_name)} ${msg}.` };
  });
}

export async function recordCargo(values: CargoValues): Promise<ActionState> {
  return guard(async () => {
    const user = await getCurrentUser();
    const v = cargoSchema.safeParse(values);
    if (!v.success) {
      const e = firstErrors(v.error);
      return { error: e.message, fieldErrors: e.fields };
    }
    const d = v.data;
    if (!user || !(await canRecordOn(user, d.project_id))) return { error: "Bu projede kayıt girme yetkiniz yok." };
    const now = new Date().toISOString();
    const { error } = await createAdminClient(user.id).from("visitor_logs").insert({
      project_id: d.project_id,
      kind: "kargo",
      courier: d.courier.trim(),
      destination: d.destination.trim(),
      package_count: d.package_count,
      full_name: d.full_name ? toTitleCase(d.full_name) : null,
      note: nul(d.note),
      delivered_at: d.delivered_now ? now : null,
      delivered_to: d.delivered_now ? (d.delivered_to ? toTitleCase(d.delivered_to) : "Sahibine teslim") : null,
      ...who(user),
    });
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: d.delivered_now ? "Kargo kaydedildi ve teslim edildi." : "Kargo kaydedildi; kulübede bekliyor." };
  });
}

type Row = { id: string; project_id: string; kind: string; approval: string | null; exited_at: string | null; delivered_at: string | null; personnel_id: string | null; entered_at: string };

/** Kaydı okur ve kullanıcının o projede yazma yetkisini denetler. */
async function editable(id: string): Promise<{ user: CurrentUser; row: Row } | { error: string }> {
  if (!isUuid(id)) return { error: "Geçersiz kayıt." };
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data } = await createAdminClient().from("visitor_logs").select("id, project_id, kind, approval, exited_at, delivered_at, personnel_id, entered_at").eq("id", id).maybeSingle();
  const row = data as Row | null;
  if (!row || !(await canRecordOn(user, row.project_id))) return { error: "Kayıt bulunamadı ya da yetkiniz yok." };
  return { user, row };
}

/** Ziyaretçi çıkış yaptı (saat şimdi). */
export async function markExit(input: { id: string }): Promise<ActionState> {
  return guard(async () => {
    const r = await editable(input?.id);
    if ("error" in r) return r;
    if (r.row.kind !== "ziyaretci") return { error: "Yalnızca ziyaretçi çıkışı işaretlenir." };
    if (r.row.exited_at) return { ok: true, message: "Çıkış zaten işaretlenmiş." };
    const { error } = await createAdminClient(r.user.id).from("visitor_logs").update({ exited_at: new Date().toISOString() }).eq("id", r.row.id);
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: "Çıkış kaydedildi." };
  });
}

/** Sakin onayı sonradan verildi / reddedildi. */
export async function setApproval(input: { id: string; approval: Approval }): Promise<ActionState> {
  return guard(async () => {
    if (!["onaylandi", "reddedildi", "bekliyor"].includes(input?.approval)) return { error: "Geçersiz seçim." };
    const r = await editable(input.id);
    if ("error" in r) return r;
    if (r.row.kind !== "ziyaretci") return { error: "Onay yalnızca ziyaretçide." };
    const { error } = await createAdminClient(r.user.id).from("visitor_logs").update({ approval: input.approval }).eq("id", r.row.id);
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: input.approval === "onaylandi" ? "Onaylandı; ziyaretçi içeride." : input.approval === "reddedildi" ? "Reddedildi; ziyaretçi içeri alınmadı." : "Onay bekliyor." };
  });
}

/** Kulübedeki kargo teslim edildi. */
export async function deliverCargo(input: { id: string; delivered_to?: string }): Promise<ActionState> {
  return guard(async () => {
    const r = await editable(input?.id);
    if ("error" in r) return r;
    if (r.row.kind !== "kargo") return { error: "Yalnızca kargo teslim edilir." };
    if (r.row.delivered_at) return { ok: true, message: "Kargo zaten teslim edilmiş." };
    const to = String(input.delivered_to ?? "").trim().slice(0, 120);
    const { error } = await createAdminClient(r.user.id)
      .from("visitor_logs")
      .update({ delivered_at: new Date().toISOString(), delivered_to: to ? toTitleCase(to) : "Sahibine teslim" })
      .eq("id", r.row.id);
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: "Kargo teslim edildi." };
  });
}

/**
 * Yanlış girilen kaydı sil. Güvenlik personeli yalnızca KENDİ girdiği kaydı ilk 30 dakika içinde silebilir;
 * panelde visitors.record yetkisi olan her kaydı silebilir (işlem geçmişinde kalır).
 */
export async function deleteLog(input: { id: string }): Promise<ActionState> {
  return guard(async () => {
    const r = await editable(input?.id);
    if ("error" in r) return r;
    if (r.user.kind === "personnel") {
      const fresh = r.row.entered_at >= ownDeleteSince();
      if (r.row.personnel_id !== r.user.personnel_id || !fresh) return { error: "Yalnızca kendi girdiğiniz kaydı ilk 30 dakika içinde silebilirsiniz. Düzeltme için yöneticinize yazın." };
    }
    const { error } = await createAdminClient(r.user.id).from("visitor_logs").delete().eq("id", r.row.id);
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: "Kayıt silindi." };
  });
}
