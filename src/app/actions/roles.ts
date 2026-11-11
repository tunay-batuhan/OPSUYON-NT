"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, validate } from "@/lib/form";
import { roleSchema, type RoleValues } from "@/lib/schemas-roles";
import type { ActionState } from "@/lib/action-types";

const UUID = /^[0-9a-f-]{36}$/i;

export type RoleSaveState = ActionState | { ok: true; message: string; id: string };

/**
 * Rol tanımlarını yalnızca Süper Yönetici değiştirir. Aynı kural veritabanında da vardır (roles / role_permissions
 * politikaları ve tetikleyicileri): müşteri rolüne yönetim yetkisi verilemez, sistem rolü silinemez, kod ve kapsam değişmez.
 */
async function assertSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.kind !== "staff" || user.roleCode !== "super_admin") throw new Error("Rolleri yalnızca Süper Yönetici düzenleyebilir.");
  return user;
}

/** Yeni rol açar ya da var olan rolün adını, açıklamasını ve yetkilerini kaydeder. Dönüşte rolün kimliği gelir. */
export async function saveRole(values: RoleValues): Promise<RoleSaveState> {
  return guard(async (): Promise<RoleSaveState> => {
    await assertSuperAdmin();
    const v = validate(roleSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const supabase = await createClient();

    // seçilen yetkiler gerçekten var mı ve bu kapsama verilebilir mi?
    const { data: perms } = await supabase.from("permissions").select("code, customer_grantable");
    const known = new Map((perms ?? []).map((p) => [p.code as string, p.customer_grantable as boolean]));
    const wanted = [...new Set(d.permissions)];
    for (const code of wanted) {
      if (!known.has(code)) return { error: `Bilinmeyen yetki: ${code}` };
      if (d.scope === "customer" && !known.get(code)) return { error: "Müşteri rollerine yalnızca görme yetkileri verilebilir." };
    }

    let id = d.id;
    if (id) {
      if (!UUID.test(id)) return { error: "Geçersiz rol." };
      const { data: role } = await supabase.from("roles").select("code, scope").eq("id", id).maybeSingle();
      if (!role) return { error: "Rol bulunamadı." };
      if (role.code === "super_admin") return { error: "Süper Yönetici rolü değiştirilemez; tüm yetkilere sahiptir." };
      if (role.scope !== d.scope) return { error: "Rolün kapsamı değiştirilemez." };
      const { error } = await supabase.from("roles").update({ name: d.name, description: nul(d.description) }).eq("id", id);
      if (error) return { error: pgMessage(error) };
    } else {
      const code = `${d.scope === "staff" ? "ozel_merkez" : "ozel_musteri"}_${randomBytes(4).toString("hex")}`;
      const { data: created, error } = await supabase
        .from("roles")
        .insert({ code, name: d.name, description: nul(d.description), scope: d.scope })
        .select("id")
        .single();
      if (error) return { error: pgMessage(error) };
      id = created.id as string;
    }

    // yetkiler: fark kadar ekle / çıkar
    const { data: current } = await supabase.from("role_permissions").select("permission_code").eq("role_id", id);
    const have = new Set((current ?? []).map((r) => r.permission_code as string));
    const add = wanted.filter((c) => !have.has(c));
    const remove = [...have].filter((c) => !wanted.includes(c));
    if (remove.length) {
      const { error } = await supabase.from("role_permissions").delete().eq("role_id", id).in("permission_code", remove);
      if (error) return { error: pgMessage(error) };
    }
    if (add.length) {
      const { error } = await supabase.from("role_permissions").insert(add.map((permission_code) => ({ role_id: id, permission_code })));
      if (error) return { error: pgMessage(error) };
    }
    // yetki değişikliği de işlem geçmişinde görünsün (rol satırı güncellenir)
    if (d.id && (add.length || remove.length)) await supabase.from("roles").update({ updated_at: new Date().toISOString() }).eq("id", id);

    revalidatePath("/", "layout"); // menüler ve yetkiler her yerde değişebilir
    return { ok: true, id, message: d.id ? "Rol kaydedildi. Bu roldeki kullanıcıların yetkileri hemen güncellendi." : "Rol oluşturuldu." };
  });
}

/** Özel rolü siler: yalnızca kimse kullanmıyorsa. Sistem rolleri silinemez. */
export async function deleteRole(input: { id: string }): Promise<ActionState> {
  return guard(async () => {
    await assertSuperAdmin();
    if (!UUID.test(input.id ?? "")) return { error: "Geçersiz rol." };
    const supabase = await createClient();
    const { data: role } = await supabase.from("roles").select("is_system").eq("id", input.id).maybeSingle();
    if (!role) return { error: "Rol bulunamadı." };
    if (role.is_system) return { error: "Sistem rolleri silinemez." };
    const [{ count: staff }, { count: members }] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("staff_role_id", input.id),
      supabase.from("project_members").select("id", { count: "exact", head: true }).eq("role_id", input.id),
    ]);
    const used = (staff ?? 0) + (members ?? 0);
    if (used > 0) return { error: `Bu rol ${used} hesapta kullanılıyor. Önce o hesaplara başka rol verin.` };
    const { data, error } = await supabase.from("roles").delete().eq("id", input.id).select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Rol silinemedi." };
    revalidatePath("/merkez/yetkiler", "layout");
    return { ok: true, message: "Rol silindi." };
  });
}
