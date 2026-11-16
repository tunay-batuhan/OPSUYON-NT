import "server-only";
import { hasPermission, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import type { PersonnelAccountInfo } from "@/components/personnel-account";

/** Personel giriş adresi (hesap bilgisiyle birlikte personele gönderilir). */
export const PERSONNEL_LOGIN_URL = `${SITE_URL.replace(/\/$/, "")}/giris`;

/**
 * Personel kartındaki "Personel hesabı" kutusu için: hesap özeti (kullanıcı adı, durum, son giriş) ve bu kullanıcının
 * hesabı yönetip yönetemeyeceği. Müşteri için yetki, personelin AKTİF görevli olduğu projede aranır (sunucu işlemleriyle aynı kural).
 */
export async function loadPersonnelAccount(user: CurrentUser, personnelId: string): Promise<{ account: PersonnelAccountInfo; canManage: boolean }> {
  const supabase = await createClient();
  const [{ data: rows }, { data: active }] = await Promise.all([
    supabase.rpc("personnel_accounts", { p_ids: [personnelId] }),
    supabase.from("personnel_assignments").select("project_id").eq("personnel_id", personnelId).is("end_date", null).maybeSingle(),
  ]);
  const row = ((rows ?? []) as { username: string; is_active: boolean; last_login_at: string | null; must_change_password: boolean }[])[0];
  const account: PersonnelAccountInfo = row
    ? { username: row.username, is_active: row.is_active, last_login_at: row.last_login_at, must_change_password: row.must_change_password }
    : null;

  let canManage = false;
  if (user.kind === "staff") {
    canManage = hasPermission(user, "personnel.accounts") || hasPermission(user, "users.manage");
  } else if (user.kind === "customer" && active?.project_id) {
    const { data: perms } = await supabase.rpc("my_project_permissions", { p_project_id: active.project_id });
    canManage = ((perms as string[] | null) ?? []).includes("personnel.accounts");
  }
  return { account, canManage };
}
