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
  membershipSchema, resetPasswordSchema, staffRoleSchema, userSchema,
  type MembershipValues, type ResetPasswordValues, type StaffRoleValues, type UserValues,
} from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export async function createUser(values: UserValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("users.manage");
    const v = validate(userSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const username = slugify(d.username || d.full_name).slice(0, 32);
    if (!USERNAME_RE.test(username)) {
      return { error: "Kullanıcı adı oluşturulamadı.", fieldErrors: { username: "3-32 karakter; harf, rakam, . _ - kullanın" } };
    }

    const admin = createAdminClient();
    const organization_id = d.kind === "customer" ? d.organization_id : null;
    let staff_role_id: string | null = null;

    if (d.kind === "staff") {
      staff_role_id = d.staff_role_id;
      const { data: role } = await admin.from("roles").select("code, scope").eq("id", staff_role_id).maybeSingle();
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

    // Customers: grant access to the chosen projects in the same step.
    let granted = 0;
    if (d.kind === "customer" && d.role_id && d.project_ids.length) {
      const { error: mErr } = await admin
        .from("project_members")
        .insert(d.project_ids.map((project_id) => ({ project_id, user_id: created.user.id, role_id: d.role_id })));
      if (mErr) {
        return {
          ok: true,
          message: `Hesap oluşturuldu ancak proje erişimi verilemedi (${pgMessage(mErr)}). Kullanıcı sayfasından ekleyin.\nKullanıcı adı: ${username}\nParola: ${password}`,
        };
      }
      granted = d.project_ids.length;
    }

    revalidatePath("/merkez/kullanicilar");
    return {
      ok: true,
      message: [
        "Hesap oluşturuldu. Bilgileri müşteriye iletin (parola bir daha gösterilmez):",
        `Kullanıcı adı: ${username}`,
        `Parola: ${password}`,
        d.kind === "customer"
          ? `Giriş: opsuyon.com → hizmet alanı butonu${granted ? ` · ${granted} projeye erişim verildi` : " · henüz projeye erişimi yok"}`
          : "Giriş: opsuyon.com → Merkez girişi",
      ].join("\n"),
    };
  });
}

export async function resetPassword(values: ResetPasswordValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("users.manage");
    const v = validate(resetPasswordSchema, values);
    if (!v.ok) return v.state;
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
  const active = fd.get("active") === "1";
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: active }).eq("id", id);
  // Also block Auth itself so refresh tokens / password sign-ins stop immediately.
  await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  revalidatePath(`/merkez/kullanicilar/${id}`);
  revalidatePath("/merkez/kullanicilar");
}

export async function updateStaffRole(values: StaffRoleValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("users.manage");
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
    revalidatePath(`/merkez/kullanicilar/${id}`);
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
    revalidatePath(`/merkez/kullanicilar/${user_id}`);
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
  if (user_id) revalidatePath(`/merkez/kullanicilar/${user_id}`);
}

export async function changeMembershipRole(fd: FormData): Promise<void> {
  await assertStaff("users.manage");
  const id = str(fd, "id");
  const role_id = str(fd, "role_id");
  const user_id = str(fd, "user_id");
  if (!id || !role_id) return;
  const supabase = await createClient();
  await supabase.from("project_members").update({ role_id }).eq("id", id);
  if (user_id) revalidatePath(`/merkez/kullanicilar/${user_id}`);
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
  if (user_id) revalidatePath(`/merkez/kullanicilar/${user_id}`);
}
