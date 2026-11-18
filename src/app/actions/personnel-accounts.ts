"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser, hasPermission, type CurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/supabase/env";
import { slugify } from "@/lib/format";
import { isUuid } from "@/lib/lookups";

/**
 * Personel hesapları (Görevlerim ekranına giriş). Hesabı açabilen:
 *   * merkez: "personnel.accounts" ya da "users.manage" yetkisi
 *   * müşteri (site müdürü): personelin AKTİF görevli olduğu projede "personnel.accounts" yetkisi
 * Kullanıcı adı addan üretilir (mehmet.kaya); geçici parola okunması kolaydır ve ilk girişte değiştirilir.
 */

export type AccountResult = { ok: true; username: string; password?: string; message: string } | { ok: false; error: string };

const CONSONANTS = "bcdfghjkmnprstvyz";
const VOWELS = "aeiou";

/** "kalu4827" gibi: 4 harf (sessiz-sesli) + 4 rakam; telefonda söylemesi ve yazması kolay. */
function tempPassword() {
  const letters = Array.from({ length: 4 }, (_, i) => (i % 2 === 0 ? CONSONANTS : VOWELS)[randomInt(i % 2 === 0 ? CONSONANTS.length : VOWELS.length)]).join("");
  const digits = String(randomInt(1000, 10000));
  return letters + digits;
}

type Target = { personnelId: string; fullName: string; status: string; projectId: string | null };

/** Personel kartı + aktif projesi (servis anahtarıyla; yetki ardından denetlenir). */
async function loadTarget(personnelId: string): Promise<Target | null> {
  const admin = createAdminClient();
  const [{ data: p }, { data: a }] = await Promise.all([
    admin.from("personnel").select("id, full_name, status").eq("id", personnelId).maybeSingle(),
    admin.from("personnel_assignments").select("project_id").eq("personnel_id", personnelId).is("end_date", null).maybeSingle(),
  ]);
  if (!p) return null;
  return { personnelId: p.id, fullName: p.full_name, status: p.status, projectId: (a?.project_id as string | undefined) ?? null };
}

/** Bu kişi bu personelin hesabını yönetebilir mi? Müşteri için yetki, personelin şu anki projesinde aranır. */
async function mayManage(user: CurrentUser | null, target: Target): Promise<boolean> {
  if (!user) return false;
  if (user.kind === "staff") return hasPermission(user, "personnel.accounts") || hasPermission(user, "users.manage");
  if (user.kind !== "customer" || !target.projectId) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_project_permissions", { p_project_id: target.projectId });
  return ((data as string[] | null) ?? []).includes("personnel.accounts");
}

function revalidate(personnelId: string) {
  revalidatePath(`/merkez/personel/${personnelId}`);
  revalidatePath(`/personel/${personnelId}`);
  revalidatePath("/is-planlama");
}

async function uniqueUsername(fullName: string): Promise<string> {
  const base = slugify(fullName).replace(/-+/g, ".").replace(/\.+/g, ".").replace(/^[._-]+|[._-]+$/g, "").slice(0, 28) || "personel";
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("username").ilike("username", `${base}%`).limit(200);
  const taken = new Set(((data ?? []) as { username: string }[]).map((r) => r.username.toLowerCase()));
  const safe = base.length >= 3 ? base : `${base}.prs`;
  if (!taken.has(safe)) return safe;
  for (let i = 2; i < 500; i++) if (!taken.has(`${safe}${i}`)) return `${safe}${i}`;
  return `${safe}${randomInt(1000, 9999)}`;
}

export async function createPersonnelAccount(personnelId: string): Promise<AccountResult> {
  try {
    if (!isUuid(personnelId)) return { ok: false, error: "Geçersiz istek." };
    const [user, target] = await Promise.all([getCurrentUser(), loadTarget(personnelId)]);
    if (!target) return { ok: false, error: "Personel bulunamadı." };
    if (!(await mayManage(user, target))) return { ok: false, error: "Bu personel için hesap açma yetkiniz yok." };
    if (target.status === "terminated") return { ok: false, error: "Ayrılmış personele hesap açılamaz." };

    const admin = createAdminClient(user!.id);
    const { data: existing } = await admin.from("profiles").select("id").eq("personnel_id", personnelId).maybeSingle();
    if (existing) return { ok: false, error: "Bu personelin zaten bir hesabı var." };

    const username = await uniqueUsername(target.fullName);
    const password = tempPassword();
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username, full_name: target.fullName },
    });
    if (authErr || !created.user) return { ok: false, error: authErr?.message ?? "Hesap oluşturulamadı." };

    const { error: pErr } = await admin.from("profiles").insert({
      id: created.user.id,
      username,
      full_name: target.fullName,
      kind: "personnel",
      personnel_id: personnelId,
      must_change_password: true,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: pErr.code === "23505" ? "Bu personelin zaten bir hesabı var." : (pErr.message ?? "Hesap oluşturulamadı.") };
    }
    revalidate(personnelId);
    return { ok: true, username, password, message: "Hesap açıldı. Bilgileri personele iletin; ilk girişte kendi parolasını belirleyecek." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Hesap oluşturulamadı." };
  }
}

async function accountOf(personnelId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, is_active")
    .eq("personnel_id", personnelId)
    .eq("kind", "personnel")
    .maybeSingle();
  return data as { id: string; username: string; is_active: boolean } | null;
}

export async function resetPersonnelPassword(personnelId: string): Promise<AccountResult> {
  try {
    if (!isUuid(personnelId)) return { ok: false, error: "Geçersiz istek." };
    const [user, target] = await Promise.all([getCurrentUser(), loadTarget(personnelId)]);
    if (!target) return { ok: false, error: "Personel bulunamadı." };
    if (!(await mayManage(user, target))) return { ok: false, error: "Bu personelin parolasını sıfırlama yetkiniz yok." };
    const account = await accountOf(personnelId);
    if (!account) return { ok: false, error: "Bu personelin hesabı yok." };

    const password = tempPassword();
    const admin = createAdminClient(user!.id);
    const { error } = await admin.auth.admin.updateUserById(account.id, { password });
    if (error) return { ok: false, error: error.message };
    await admin.from("profiles").update({ must_change_password: true }).eq("id", account.id);
    revalidate(personnelId);
    return { ok: true, username: account.username, password, message: "Yeni geçici parola oluşturuldu. Personel girişte kendi parolasını belirleyecek." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Parola sıfırlanamadı." };
  }
}

export async function setPersonnelAccountActive(personnelId: string, active: boolean): Promise<AccountResult> {
  try {
    if (!isUuid(personnelId)) return { ok: false, error: "Geçersiz istek." };
    const [user, target] = await Promise.all([getCurrentUser(), loadTarget(personnelId)]);
    if (!target) return { ok: false, error: "Personel bulunamadı." };
    if (!(await mayManage(user, target))) return { ok: false, error: "Bu personelin hesabını değiştirme yetkiniz yok." };
    if (active && target.status === "terminated") return { ok: false, error: "Ayrılmış personelin hesabı açılamaz." };
    const account = await accountOf(personnelId);
    if (!account) return { ok: false, error: "Bu personelin hesabı yok." };

    const admin = createAdminClient(user!.id);
    const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", account.id);
    if (error) return { ok: false, error: error.message };
    // Auth tarafında da kapatılır: açık oturumlar yenilenemez
    await admin.auth.admin.updateUserById(account.id, { ban_duration: active ? "none" : "876000h" });
    revalidate(personnelId);
    return { ok: true, username: account.username, message: active ? "Hesap yeniden açıldı." : "Hesap kapatıldı; personel artık giriş yapamaz." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "İşlem yapılamadı." };
  }
}
