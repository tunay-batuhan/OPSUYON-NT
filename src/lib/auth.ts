import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type CurrentUser = Profile & {
  email: string | undefined;
  roleCode: string | null;
  roleName: string | null;
  /** Global (merkez) permissions — empty for customers. */
  permissions: string[];
};

/**
 * Data-access-layer entry point: validates the session with Supabase Auth,
 * loads the profile (RLS lets a user read their own row) and permissions.
 * Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, roles:staff_role_id(code, name)")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) return null;

  let permissions: string[] = [];
  if (profile.kind === "staff") {
    const { data } = await supabase.rpc("my_global_permissions");
    permissions = (data as string[] | null) ?? [];
  }

  const { roles, ...rest } = profile as Profile & { roles: { code: string; name: string } | null };
  return {
    ...rest,
    email: auth.user.email,
    roleCode: roles?.code ?? null,
    roleName: roles?.name ?? null,
    permissions,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/** Staff-only gate; optionally requires a global permission. */
export async function requireStaff(permission?: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.kind !== "staff") redirect("/panel");
  if (permission && !hasPermission(user, permission)) redirect("/merkez?yetki=yok");
  return user;
}

export async function requireCustomer(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.kind !== "customer") redirect("/merkez");
  return user;
}

export function hasPermission(
  user: Pick<CurrentUser, "kind" | "permissions" | "roleCode">,
  permission: string,
): boolean {
  if (user.kind !== "staff") return false;
  return user.roleCode === "super_admin" || user.permissions.includes(permission);
}

/** For server actions: throws instead of redirecting. */
export async function assertStaff(permission: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.kind !== "staff" || !hasPermission(user, permission)) {
    throw new Error("Bu işlem için yetkiniz yok.");
  }
  return user;
}

export const homePathFor = (user: Pick<Profile, "kind">) => (user.kind === "staff" ? "/merkez" : "/panel");
