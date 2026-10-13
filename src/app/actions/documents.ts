"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublicKey } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toNumber } from "@/lib/parse";
import { documentSchema, type DocumentValues } from "@/lib/schemas";
import { slugify } from "@/lib/format";
import type { ActionState } from "@/lib/action-types";

const BUCKET = "documents";

export type PreparedUpload = {
  path: string;
  signedUrl: string;
  anonKey: string;
};

/**
 * Step 1 of an upload: after checking the caller, hand the browser a one-time
 * signed upload URL so the file goes straight to Storage (no server body limit).
 */
export async function prepareUpload(input: {
  projectId: string;
  category: string;
  fileName: string;
}): Promise<{ error: string } | PreparedUpload> {
  try {
    await assertStaff("documents.manage");
    if (!/^[0-9a-f-]{36}$/i.test(input.projectId) || !/^[a-z][a-z0-9_]*$/.test(input.category)) {
      return { error: "Geçersiz istek." };
    }
    const dot = input.fileName.lastIndexOf(".");
    const ext = dot > 0 ? slugify(input.fileName.slice(dot + 1)).slice(0, 8) : "";
    const base = slugify(dot > 0 ? input.fileName.slice(0, dot) : input.fileName).slice(0, 60) || "dosya";
    const path = `${input.projectId}/${input.category}/${randomUUID()}-${base}${ext ? "." + ext : ""}`;

    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? "Yükleme hazırlanamadı." };
    return { path, signedUrl: data.signedUrl, anonKey: supabasePublicKey() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yükleme hazırlanamadı." };
  }
}

/** Step 2: the file is in Storage; register it in the documents table. */
export async function registerDocument(values: DocumentValues): Promise<ActionState> {
  return guard(async () => {
    const user = await assertStaff("documents.manage");
    const v = validate(documentSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    if (!d.storage_path.startsWith(`${d.project_id}/`)) return { error: "Geçersiz dosya yolu." };

    const supabase = await createClient();
    const { error } = await supabase.from("documents").insert({
      project_id: d.project_id,
      category_code: d.category_code,
      storage_path: d.storage_path,
      title: d.title,
      file_name: d.file_name,
      mime_type: nul(d.mime_type),
      size_bytes: toNumber(d.size_bytes),
      personnel_id: nul(d.personnel_id),
      period_year: toNumber(d.period_year),
      period_month: toNumber(d.period_month),
      description: nul(d.description),
      customer_visible: d.customer_visible,
      uploaded_by: user.id,
    });
    if (error) {
      await createAdminClient().storage.from(BUCKET).remove([d.storage_path]);
      return { error: pgMessage(error) };
    }
    revalidatePath(`/projeler/${d.project_id}/belgeler`);
    return { ok: true, message: "Belge yüklendi." };
  });
}

export async function setDocumentVisibility(fd: FormData): Promise<void> {
  await assertStaff("documents.manage");
  const id = str(fd, "id");
  const project_id = str(fd, "project_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("documents").update({ customer_visible: fd.get("visible") === "1" }).eq("id", id);
  if (project_id) revalidatePath(`/projeler/${project_id}/belgeler`);
}

export async function deleteDocument(fd: FormData): Promise<void> {
  await assertStaff("documents.manage");
  const id = str(fd, "id");
  const project_id = str(fd, "project_id");
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return;
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (!error) await createAdminClient().storage.from(BUCKET).remove([data.storage_path]);
  if (project_id) revalidatePath(`/projeler/${project_id}/belgeler`);
}
