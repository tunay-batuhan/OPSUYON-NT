import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Permission, Profile, Role } from "@/lib/types";

export type Member = {
  id: string;
  role_id: string;
  projects: { id: string; name: string; service_line: string } | null;
};

const customerGrantable = (p: Permission) =>
  !["yonetim"].includes(p.module) && !p.code.endsWith(".manage") && p.code !== "messages.manage";

export const moduleLabel: Record<string, string> = { yonetim: "Yönetim", projeler: "Projeler", personel: "Personel & izin", belgeler: "Belgeler", finans: "Finans & cari hesap", iletisim: "İletişim", raporlar: "Raporlar", devriye: "Devriye" };

/** Kullanıcı detayının tüm verisi; layout ve sekme sayfaları aynı istekte paylaşır (bir kez yüklenir). */
export const loadUserDetail = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await requireStaff("users.read");
  const manage = hasPermission(me, "users.manage");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(name), roles:staff_role_id(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();
  const u = profile as unknown as Profile & { organizations: { name: string } | null; roles: { id: string; name: string } | null };

  const [{ data: allRoles }, { data: perms }, { data: rolePerms }] = await Promise.all([
    supabase.from("roles").select("*").order("name"),
    supabase.from("permissions").select("*").order("sort_order"),
    supabase.from("role_permissions").select("role_id, permission_code"),
  ]);
  const roles = (allRoles ?? []) as Role[];
  const allPermissions = (perms ?? []) as Permission[];
  const permissions = allPermissions.filter(customerGrantable);
  const customerRoles = roles.filter((r) => r.scope === "customer");
  const staffRoles = roles.filter((r) => r.scope === "staff" && (r.code !== "super_admin" || me.roleCode === "super_admin"));
  const roleGrants = new Map<string, Set<string>>();
  (rolePerms ?? []).forEach((rp) => {
    if (!roleGrants.has(rp.role_id)) roleGrants.set(rp.role_id, new Set());
    roleGrants.get(rp.role_id)!.add(rp.permission_code);
  });

  let members: Member[] = [];
  const overrides = new Map<string, Map<string, boolean>>();
  let availableProjects: { id: string; name: string }[] = [];
  if (u.kind === "customer") {
    const [{ data: m }, { data: ov }, { data: pr }] = await Promise.all([
      supabase.from("project_members").select("id, role_id, projects(id, name, service_line)").eq("user_id", id),
      supabase.from("member_permission_overrides").select("member_id, permission_code, is_allowed"),
      supabase.from("projects").select("id, name").eq("organization_id", u.organization_id!).order("name"),
    ]);
    members = (m ?? []) as unknown as Member[];
    (ov ?? []).forEach((o) => {
      if (!overrides.has(o.member_id)) overrides.set(o.member_id, new Map());
      overrides.get(o.member_id)!.set(o.permission_code, o.is_allowed);
    });
    const taken = new Set(members.map((x) => x.projects?.id));
    availableProjects = ((pr ?? []) as { id: string; name: string }[]).filter((p) => !taken.has(p.id));
  }

  const staffOverrides = new Map<string, boolean>();
  if (u.kind === "staff") {
    const { data: so } = await supabase.from("staff_permission_overrides").select("permission_code, is_allowed").eq("user_id", id);
    (so ?? []).forEach((o) => staffOverrides.set(o.permission_code as string, o.is_allowed as boolean));
  }
  const isTargetSuper = u.roles?.name === "Süper Yönetici";
  const byModule = new Map<string, Permission[]>();
  allPermissions.forEach((p) => byModule.set(p.module, [...(byModule.get(p.module) ?? []), p]));

  return {
    me, manage, u, permissions, customerRoles, staffRoles, roleGrants, members, overrides, availableProjects,
    staffOverrides, isTargetSuper, byModule,
    isSelf: me.id === u.id,
    canEditStaffPerms: me.roleCode === "super_admin" && u.kind === "staff" && !isTargetSuper,
    staffBase: roleGrants.get(u.staff_role_id ?? "") ?? new Set<string>(),
  };
});
