"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { str } from "@/lib/form";

/** Müşteri panelinde bir ekranı açar / kapatır. Yeniden yayına gerek yoktur. */
export async function setModuleEnabled(fd: FormData): Promise<void> {
  await assertStaff("access.manage");
  const code = str(fd, "code");
  if (!code) return;
  const enabled = fd.get("enabled") === "1";
  const supabase = await createClient();
  await supabase.from("app_modules").update({ enabled }).eq("code", code).eq("implemented", true);
  revalidatePath("/", "layout");
}
