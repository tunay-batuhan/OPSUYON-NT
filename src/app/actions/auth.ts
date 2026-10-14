"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/supabase/env";
import { guard, validate } from "@/lib/form";
import { changePasswordSchema, loginSchema, type ChangePasswordValues, type LoginValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";
import type { Profile } from "@/lib/types";

const GENERIC_ERROR = "Kullanıcı adı veya parola hatalı.";

/** Tek giriş: merkez de müşteri de aynı ekrandan girer; hesabın türü ve yetkisi hangi ekranın açılacağını belirler. */
export async function loginAction(values: LoginValues): Promise<ActionState> {
  return guard(async () => {
    const v = validate(loginSchema, values);
    if (!v.ok) return v.state;
    const { username, password } = v.data;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error || !data.user) return { error: GENERIC_ERROR };

    const deny = async (message: string): Promise<ActionState> => {
      await supabase.auth.signOut();
      return { error: message };
    };

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle<Profile>();
    if (!profile) return deny(GENERIC_ERROR);
    if (!profile.is_active) return deny("Hesabınız kısıtlanmıştır. Lütfen merkez ile iletişime geçin.");

    if (profile.kind === "customer") {
      const { count } = await supabase.from("projects").select("id", { count: "exact", head: true });
      if (!count) return deny("Hesabınıza henüz proje tanımlanmamış. Lütfen merkez ile iletişime geçin.");
    } else {
      // pasife alınması gereken projeleri güncelle (gece görevi çalışmamış olsa bile)
      await supabase.rpc("close_expired_projects");
    }

    await createAdminClient().from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", profile.id);

    redirect(profile.kind === "staff" ? "/merkez" : "/panel");
  });
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function changeOwnPassword(values: ChangePasswordValues): Promise<ActionState> {
  return guard(async () => {
    const v = validate(changePasswordSchema, values);
    if (!v.ok) return v.state;
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { error: "Oturum süresi doldu. Lütfen yeniden giriş yapın." };
    const { error } = await supabase.auth.updateUser({ password: v.data.password });
    if (error) {
      if (/different|same/i.test(error.message)) return { error: "Yeni parola eskisinden farklı olmalı.", fieldErrors: { password: "Yeni parola eskisinden farklı olmalı" } };
      return { error: error.message };
    }
    return { ok: true, message: "Parolanız güncellendi." };
  });
}
