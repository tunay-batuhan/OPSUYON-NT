import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAnywhere, getCurrentUser } from "@/lib/auth";

export type AppModule = {
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  implemented: boolean;
  sort_order: number;
};

/** Müşteri panelindeki ekranlar birer modüldür; açık/kapalı durumu veritabanında tutulur. */
export const getModules = cache(async (): Promise<AppModule[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_modules").select("*").order("sort_order");
  return (data ?? []) as AppModule[];
});

export const getEnabledModules = cache(async (): Promise<Set<string>> => {
  const mods = await getModules();
  return new Set(mods.filter((m) => m.enabled && m.implemented).map((m) => m.code));
});

/**
 * Müşteri hesapları için modül kapalıysa sayfa 404 olur. Merkez (staff) her zaman geçer:
 * müşterinin göreceği belgeleri merkez yönetir.
 */
export async function requireModule(code: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.kind === "staff") return;
  if (!(await getEnabledModules()).has(code)) notFound();
}

/** Modül açık mı (müşteri için) ve kullanıcı bu izne en az bir projede sahip mi? */
export async function requireAccess(code: string, permission: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.kind === "customer" && !(await getEnabledModules()).has(code)) notFound();
  if (!canAnywhere(user, permission)) notFound();
  return user;
}
