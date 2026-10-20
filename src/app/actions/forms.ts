"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublicKey } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toNumber } from "@/lib/parse";
import { formTemplateSchema, type FormTemplateValues } from "@/lib/schemas";
import { slugify } from "@/lib/format";
import type { ActionState } from "@/lib/action-types";

const BUCKET = "documents";

/** Form şablonu yüklemesi, adım 1: tarayıcıya tek kullanımlık imzalı yükleme adresi verilir. */
export async function prepareFormUpload(input: { fileName: string }): Promise<{ error: string } | { path: string; signedUrl: string; anonKey: string }> {
  try {
    await assertStaff("documents.manage");
    const dot = input.fileName.lastIndexOf(".");
    const ext = dot > 0 ? slugify(input.fileName.slice(dot + 1)).slice(0, 8) : "";
    const base = slugify(dot > 0 ? input.fileName.slice(0, dot) : input.fileName).slice(0, 60) || "form";
    const path = `forms/${randomUUID()}-${base}${ext ? "." + ext : ""}`;
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? "Yükleme hazırlanamadı." };
    return { path, signedUrl: data.signedUrl, anonKey: supabasePublicKey() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yükleme hazırlanamadı." };
  }
}

/** Adım 2: dosya Storage'da; şablonu listeye kaydet. */
export async function registerFormTemplate(values: FormTemplateValues): Promise<ActionState> {
  return guard(async () => {
    const user = await assertStaff("documents.manage");
    const v = validate(formTemplateSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    if (!d.storage_path.startsWith("forms/")) return { error: "Geçersiz dosya yolu." };

    const supabase = await createClient();
    const { error } = await supabase.from("form_templates").insert({
      title: d.title,
      description: nul(d.description),
      storage_path: d.storage_path,
      file_name: d.file_name,
      mime_type: nul(d.mime_type),
      size_bytes: toNumber(d.size_bytes),
      uploaded_by: user.id,
    });
    if (error) {
      await createAdminClient().storage.from(BUCKET).remove([d.storage_path]);
      return { error: pgMessage(error) };
    }
    revalidatePath("/formlar");
    return { ok: true, message: "Form eklendi." };
  });
}

export async function deleteFormTemplate(fd: FormData): Promise<void> {
  await assertStaff("documents.manage");
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase.from("form_templates").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return;
  const { error } = await supabase.from("form_templates").delete().eq("id", id);
  if (!error) await createAdminClient().storage.from(BUCKET).remove([data.storage_path]);
  revalidatePath("/formlar");
}
