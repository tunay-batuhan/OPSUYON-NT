"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/supabase/env";
import { guard, validate } from "@/lib/form";
import { loginSchema, type LoginValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";
import type { Profile } from "@/lib/types";

const GENERIC_ERROR = "Kullanıcı adı veya parola hatalı.";

export async function loginAction(values: LoginValues): Promise<ActionState> {
  return guard(async () => {
    const v = validate(loginSchema, values);
    if (!v.ok) return v.state;
    const { hat, username, password } = v.data;

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

    if (hat === "merkez" && profile.kind !== "staff") {
      return deny("Merkez girişi yalnızca merkez personeli içindir.");
    }

    // Customers may use any button: we send them to the service line they actually have projects in.
    let landing = hat;
    if (profile.kind === "customer") {
      const { data: mine } = await supabase.from("projects").select("service_line");
      const lines = [...new Set((mine ?? []).map((p) => p.service_line as string))];
      if (!lines.length) return deny("Hesabınıza henüz proje tanımlanmamış. Lütfen merkez ile iletişime geçin.");
      if (!lines.includes(hat)) landing = lines[0];
    }

    await createAdminClient().from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", profile.id);

    redirect(profile.kind === "staff" ? "/merkez" : `/panel?hat=${encodeURIComponent(landing)}`);
  });
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
