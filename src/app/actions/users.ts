"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { slugify } from "@/lib/format";
import {
  customerUserSchema, membershipSchema, resetPasswordSchema, staffRoleSchema, staffUserSchema,
  type CustomerUserValues, type MembershipValues, type ResetPasswordValues, type StaffRoleValues, type StaffUserValues,
} from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

type Actor = Awaited<ReturnType<typeof assertStaff>>;
const SUPER_ONLY = "Merkez hesaplarını yalnızca Süper Yönetici yönetebilir.";

/**
 * Merkez hesapları (parola, kısıtlama, rol) yalnızca Süper Yönetici tarafından yönetilir: "kullanıcı yönetme"
 * yetkisi olan bir merkez çalışanı bir yöneticinin parolasını sıfırlayarak ya da rolünü değiştirerek yetkisini
 * yükseltememeli. Aynı kural veritabanında da vardır (app.guard_profiles); bu denetim servis anahtarıyla yapılan
 * işlemler (parola, Auth kısıtlaması) içindir. Hedef bulunamazsa da reddedilir.
 */
async function denyUnlessMayManage(actor: Actor, targetId: string): Promise<string | null> {
  if (actor.roleCode === "super_admin") return null;
  const { data: target } = await createAdminClient().from("profiles").select("kind").eq("id", targetId).maybeSingle();
  if (!target) return "Kullanıcı bulunamadı.";
  return target.kind === "staff" ? SUPER_ONLY : null;
}

type NewAccount = {
  kind: "customer" | "staff";
  full_name: string;
  username: string;
  phone: string;
  password: string;
  organization_id?: string;
  staff_role_id?: string;
  project_ids?: string[];
  role_id?: string;
};

async function createAccount(actor: Actor, d: NewAccount): Promise<ActionState> {
  const username = slugify(d.username || d.full_name).slice(0, 32);
  if (!USERNAME_RE.test(username)) {
    return { error: "Kullanıcı adı oluşturulamadı.", fieldErrors: { username: "3-32 karakter; harf, rakam, . _ - kullanın" } };
  }

  const admin = createAdminClient(actor.id);
  const organization_id = d.kind === "customer" ? (d.organization_id ?? null) : null;
  let staff_role_id: string | null = null;

  if (d.kind === "staff") {
    if (actor.roleCode !== "super_admin") return { error: "Merkez hesabını yalnızca Süper Yönetici açabilir." };
    staff_role_id = d.staff_role_id ?? null;
    const { data: role } = await admin.from("roles").select("code, scope").eq("id", staff_role_id ?? "").maybeSingle();
    if (!role || role.scope !== "staff") return { error: "Geçersiz rol.", fieldErrors: { staff_role_id: "Geçersiz rol" } };
    if (role.code === "super_admin" && actor.roleCode !== "super_admin") {
      return { error: "Süper yönetici yalnızca bir süper yönetici tarafından oluşturulabilir.", fieldErrors: { staff_role_id: "Bu rolü atama yetkiniz yok" } };
    }
  }

  const password = d.password || generatePassword();

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, full_name: d.full_name },
  });
  if (authErr || !created.user) {
    if (/already|registered|exists/i.test(authErr?.message ?? "")) {
      return { error: "Bu kullanıcı adı zaten kullanımda.", fieldErrors: { username: "Bu kullanıcı adı zaten kullanımda" } };
    }
    return { error: authErr?.message ?? "Kullanıcı oluşturulamadı." };
  }

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    full_name: d.full_name,
    kind: d.kind,
    organization_id,
    staff_role_id,
    phone: nul(d.phone),
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: pgMessage(pErr) };
  }

  // Müşteri: seçilen projelere aynı adımda erişim ver.
  let granted = 0;
  if (d.kind === "customer" && d.role_id && d.project_ids?.length) {
    const { error: mErr } = await admin
      .from("project_members")
      .insert(d.project_ids.map((project_id) => ({ project_id, user_id: created.user.id, role_id: d.role_id })));
    if (mErr) {
      return {
        ok: true,
        message: `Hesap oluşturuldu ancak proje erişimi verilemedi (${pgMessage(mErr)}). Kullanıcı sayfasından ekleyin.
Kullanıcı adı: ${username}
Parola: ${password}`,
      };
    }
    granted = d.project_ids.length;
  }

  revalidatePath("/merkez/kullanicilar");
  return {
    ok: true,
    message: [
      "Hesap oluşturuldu. Bilgileri iletin (parola bir daha gösterilmez):",
      `Kullanıcı adı: ${username}`,
      `Parola: ${password}`,
      d.kind === "customer"
        ? `Giriş: opsuyon.com → Giriş Yap${granted ? ` · ${granted} projeye erişim verildi` : " · henüz projeye erişimi yok"}`
        : "Giriş: opsuyon.com → Giriş Yap",
    ].join("\n"),
  };
}

export async function createCustomerUser(values: CustomerUserValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("users.manage");
    const v = validate(customerUserSchema, values);
    if (!v.ok) return v.state;
    return createAccount(actor, { kind: "customer", ...v.data });
  });
}

export async function createStaffUser(values: StaffUserValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("users.manage");
    const v = validate(staffUserSchema, values);
    if (!v.ok) return v.state;
    return createAccount(actor, { kind: "staff", ...v.data });
  });
}

/** Merkez personeli için kişiye özel yetki: mode = default (role uy) | allow | deny. Yalnızca süper yönetici. */
export async function setStaffOverride(fd: FormData): Promise<void> {
  const actor = await assertStaff("users.manage");
  if (actor.roleCode !== "super_admin") return;
  const user_id = str(fd, "user_id");
  const permission_code = str(fd, "permission_code");
  const mode = str(fd, "mode");
  if (!user_id || !permission_code || !mode) return;

  const supabase = await createClient();
  if (mode === "default") {
    await supabase.from("staff_permission_overrides").delete().eq("user_id", user_id).eq("permission_code", permission_code);
  } else if (mode === "allow" || mode === "deny") {
    await supabase
      .from("staff_permission_overrides")
      .upsert({ user_id, permission_code, is_allowed: mode === "allow" }, { onConflict: "user_id,permission_code" });
  }
  revalidatePath(`/merkez/kullanicilar/${user_id}`, "layout");
}

export async function resetPassword(values: ResetPasswordValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("users.manage");
    const v = validate(resetPasswordSchema, values);
    if (!v.ok) return v.state;
    const denied = await denyUnlessMayManage(actor, v.data.id);
    if (denied) return { error: denied };
    const password = v.data.password || generatePassword();

    const { error } = await createAdminClient().auth.admin.updateUserById(v.data.id, { password });
    if (error) return { error: error.message };
    return { ok: true, message: `Yeni parola: ${password} (bir daha gösterilmez).` };
  });
}

export async function setUserActive(fd: FormData): Promise<void> {
  const actor = await assertStaff("users.manage");
  const id = str(fd, "id");
  if (!id || id === actor.id) return; // never lock yourself out
  if (await denyUnlessMayManage(actor, id)) return; // merkez hesabını yalnızca Süper Yönetici kısıtlar
  const active = fd.get("active") === "1";
  const admin = createAdminClient(actor.id);
  // son Süper Yönetici kısıtlanamaz (veritabanı kuralı); hata olursa Auth tarafına dokunulmaz
  const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", id);
  if (error) return;
  // Also block Auth itself so refresh tokens / password sign-ins stop immediately.
  await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  revalidatePath(`/merkez/kullanicilar/${id}`, "layout");
  revalidatePath("/merkez/kullanicilar");
}

export async function updateStaffRole(values: StaffRoleValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("users.manage");
    if (actor.roleCode !== "super_admin") return { error: "Merkez rolünü yalnızca Süper Yönetici değiştirebilir." };
    const v = validate(staffRoleSchema, values);
    if (!v.ok) return v.state;
    const { id, staff_role_id } = v.data;

    const supabase = await createClient();
    const { data: role } = await supabase.from("roles").select("code, scope").eq("id", staff_role_id).maybeSingle();
    if (!role || role.scope !== "staff") return { error: "Geçersiz rol." };
    if (role.code === "super_admin" && actor.roleCode !== "super_admin") return { error: "Bu rolü yalnızca süper yönetici atayabilir." };
    if (id === actor.id && actor.roleCode === "super_admin" && role.code !== "super_admin") {
      return { error: "Kendi süper yönetici rolünüzü kaldıramazsınız." };
    }

    const { error } = await supabase.from("profiles").update({ staff_role_id }).eq("id", id);
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/merkez/kullanicilar/${id}`, "layout");
    return { ok: true, message: "Rol güncellendi." };
  });
}

export async function addMembership(values: MembershipValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("users.manage");
    const v = validate(membershipSchema, values);
    if (!v.ok) return v.state;
    const { user_id, project_id, role_id } = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("project_members").insert({ user_id, project_id, role_id });
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/merkez/kullanicilar/${user_id}`, "layout");
    return { ok: true, message: "Proje erişimi verildi." };
  });
}

export async function removeMembership(fd: FormData): Promise<void> {
  await assertStaff("users.manage");
  const id = str(fd, "id");
  const user_id = str(fd, "user_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("project_members").delete().eq("id", id);
  if (user_id) revalidatePath(`/merkez/kullanicilar/${user_id}`, "layout");
}

export async function changeMembershipRole(fd: FormData): Promise<void> {
  await assertStaff("users.manage");
  const id = str(fd, "id");
  const role_id = str(fd, "role_id");
  const user_id = str(fd, "user_id");
  if (!id || !role_id) return;
  const supabase = await createClient();
  await supabase.from("project_members").update({ role_id }).eq("id", id);
  if (user_id) revalidatePath(`/merkez/kullanicilar/${user_id}`, "layout");
}

/** mode: "default" (follow role) | "allow" | "deny" */
export async function setOverride(fd: FormData): Promise<void> {
  await assertStaff("users.manage");
  const member_id = str(fd, "member_id");
  const permission_code = str(fd, "permission_code");
  const mode = str(fd, "mode");
  const user_id = str(fd, "user_id");
  if (!member_id || !permission_code || !mode) return;

  const supabase = await createClient();
  if (mode === "default") {
    await supabase.from("member_permission_overrides").delete().eq("member_id", member_id).eq("permission_code", permission_code);
  } else if (mode === "allow" || mode === "deny") {
    await supabase
      .from("member_permission_overrides")
      .upsert({ member_id, permission_code, is_allowed: mode === "allow" }, { onConflict: "member_id,permission_code" });
  }
  if (user_id) revalidatePath(`/merkez/kullanicilar/${user_id}`, "layout");
}
