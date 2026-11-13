"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublicKey } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toMoney } from "@/lib/parse";
import { formatMoney, slugify } from "@/lib/format";
import { LEDGER_FILE_MAX, LEDGER_FILE_TYPES, ledgerEntrySchema, ledgerFileExt, type LedgerEntryValues } from "@/lib/schemas-ledger";
import type { ActionState } from "@/lib/action-types";

const UUID = /^[0-9a-f-]{36}$/i;
/** Cari dosyaları özel 'documents' kovasında, firmanın klasöründe: ledger/{firma}/{uuid}-{ad}.{uzantı} */
const BUCKET = "documents";
const PATH_RE = /^ledger\/[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-z0-9-]{1,60}\.[a-z0-9]{2,5}$/;

const storage = () => createAdminClient().storage.from(BUCKET);

/**
 * Yüklenen dosya gerçekten bu firmanın klasöründe ve Storage'da mı? Uzantı ve boyut sunucuda doğrulanır;
 * MIME türü tarayıcıdan değil uzantıdan belirlenir.
 */
async function checkUploaded(orgId: string, path: string, fileName: string): Promise<{ error: string } | { file_path: string; file_name: string; file_mime: string; file_size: number | null }> {
  if (!PATH_RE.test(path) || !path.startsWith(`ledger/${orgId}/`)) return { error: "Geçersiz dosya yolu." };
  const ext = ledgerFileExt(path);
  if (!ext) return { error: "Yalnızca PDF ya da görsel (JPG, PNG, WEBP, GIF) yüklenebilir." };
  const { data, error } = await storage().info(path);
  if (error || !data) return { error: "Dosya bulunamadı; lütfen yeniden seçin." };
  const size = typeof data.size === "number" ? data.size : null;
  if (size !== null && size > LEDGER_FILE_MAX) {
    await storage().remove([path]);
    return { error: "Dosya 50 MB'tan büyük olamaz." };
  }
  const name = fileName.trim().slice(0, 255) || path.slice(path.lastIndexOf("/") + 38);
  return { file_path: path, file_name: name, file_mime: LEDGER_FILE_TYPES[ext], file_size: size && size > 0 ? size : null };
}

/** Başka bir kayda bağlı olmayan dosyayı Storage'dan siler (yarım kalan kayıt / değiştirilen dosya). */
async function removeIfOrphan(path: string | null | undefined) {
  if (!path || !PATH_RE.test(path)) return;
  const { count } = await createAdminClient().from("firm_ledger_entries").select("id", { count: "exact", head: true }).eq("file_path", path);
  if (!count) await storage().remove([path]);
}

/**
 * Cari dosyası yüklemesi, adım 1: tarayıcıya tek kullanımlık imzalı yükleme adresi verilir (dosya sunucudan geçmez).
 * Yalnızca merkez finans yöneticisi; dosya seçilen firmanın klasörüne gider.
 */
export async function prepareLedgerUpload(input: { organizationId: string; fileName: string; size: number }): Promise<{ error: string } | { path: string; signedUrl: string; anonKey: string }> {
  try {
    await assertStaff("finance.manage");
    if (!UUID.test(input?.organizationId ?? "")) return { error: "Önce firmayı seçin." };
    const fileName = String(input.fileName ?? "");
    const ext = ledgerFileExt(fileName);
    if (!ext) return { error: "Yalnızca PDF ya da görsel (JPG, PNG, WEBP, GIF) yüklenebilir." };
    if (!(Number(input.size) > 0)) return { error: "Dosya boş." };
    if (Number(input.size) > LEDGER_FILE_MAX) return { error: "Dosya 50 MB'tan büyük olamaz." };
    const base = slugify(fileName.slice(0, fileName.lastIndexOf("."))).replace(/[._]+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "") || "dosya";
    const path = `ledger/${input.organizationId.toLowerCase()}/${randomUUID()}-${base}.${ext}`;
    const { data, error } = await storage().createSignedUploadUrl(path);
    if (error || !data) return { error: error?.message ?? "Yükleme hazırlanamadı." };
    return { path, signedUrl: data.signedUrl, anonKey: supabasePublicKey() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yükleme hazırlanamadı." };
  }
}

/** Formda seçilip kaydedilmeden vazgeçilen (ya da değiştirilen) dosyayı siler; bir kayda bağlıysa dokunmaz. */
export async function discardLedgerUpload(path: string): Promise<void> {
  await assertStaff("finance.manage");
  await removeIfOrphan(String(path ?? ""));
}

/**
 * Firma bazlı cari hesaba fatura ya da tahsilat girer (Cari Hesap → Fatura girişi / Tahsilat girişi).
 * İsteğe bağlı dosya (fatura PDF'i / görseli, tahsilat dekontu) aynı adımda kayda bağlanır.
 * Firmanın bakiyesi = tüm faturalar − tüm tahsilatlar.
 */
export async function createFirmLedgerEntry(values: LedgerEntryValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("finance.manage");
    const kind = values?.kind === "tahsilat" ? "tahsilat" : "fatura";
    const v = validate(ledgerEntrySchema(kind), values);
    if (!v.ok) return v.state;
    const d = v.data;
    const amount = Math.round((toMoney(d.amount) ?? 0) * 100) / 100;
    if (amount <= 0) return { error: "Tutar sıfırdan büyük olmalı.", fieldErrors: { amount: "Tutar sıfırdan büyük olmalı" } };

    const supabase = await createClient();
    // yalnızca arşivlenmemiş firmalara giriş yapılır
    const { data: org } = await supabase.from("organizations").select("name, status").eq("id", d.organization_id).maybeSingle();
    if (!org || org.status !== "active") return { error: "Firma bulunamadı veya arşivde.", fieldErrors: { organization_id: "Aktif bir firma seçin" } };

    let file: { file_path: string; file_name: string; file_mime: string; file_size: number | null } | null = null;
    if (d.file_path) {
      const checked = await checkUploaded(d.organization_id.toLowerCase(), d.file_path, d.file_name);
      if ("error" in checked) return { error: checked.error, fieldErrors: { file_path: checked.error } };
      file = checked;
    }

    const { error } = await supabase.from("firm_ledger_entries").insert({
      organization_id: d.organization_id,
      kind,
      entry_date: d.entry_date,
      entry_time: d.entry_time,
      description: nul(d.description),
      amount,
      created_by: actor.id,
      ...(file ?? {}),
    });
    if (error) {
      if (file) await removeIfOrphan(file.file_path);
      return { error: pgMessage(error) };
    }

    revalidatePath("/cari-hesap", "layout");
    const what = kind === "fatura" ? "fatura" : "tahsilat";
    return { ok: true, message: `${org.name}: ${what} kaydedildi (${formatMoney(amount)})${file ? `, dosya eklendi (${file.file_name})` : ""}.` };
  });
}

/** Var olan cari kayda dosya ekler ya da dosyasını değiştirir (eski dosya Storage'dan silinir). */
export async function attachLedgerFile(input: { id: string; file_path: string; file_name: string }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("finance.manage");
    if (!UUID.test(input?.id ?? "")) return { error: "Kayıt bulunamadı." };
    const supabase = await createClient();
    const { data: entry } = await supabase.from("firm_ledger_entries").select("organization_id, file_path").eq("id", input.id).maybeSingle();
    if (!entry) {
      await removeIfOrphan(input.file_path);
      return { error: "Kayıt bulunamadı." };
    }
    const checked = await checkUploaded(entry.organization_id, String(input.file_path ?? ""), String(input.file_name ?? ""));
    if ("error" in checked) return { error: checked.error };
    const { error } = await supabase.from("firm_ledger_entries").update(checked).eq("id", input.id);
    if (error) {
      await removeIfOrphan(checked.file_path);
      return { error: pgMessage(error) };
    }
    if (entry.file_path && entry.file_path !== checked.file_path) await removeIfOrphan(entry.file_path);
    revalidatePath("/cari-hesap", "layout");
    return { ok: true, message: entry.file_path ? "Dosya değiştirildi." : "Dosya eklendi." };
  });
}

/** Cari kaydın dosyasını kaldırır (kayıt ve tutar kalır). */
export async function removeLedgerFile(fd: FormData): Promise<void> {
  await assertStaff("finance.manage");
  const id = str(fd, "id");
  if (!id || !UUID.test(id)) return;
  const supabase = await createClient();
  const { data: entry } = await supabase.from("firm_ledger_entries").select("file_path").eq("id", id).maybeSingle();
  if (!entry?.file_path) return;
  const { error } = await supabase.from("firm_ledger_entries").update({ file_path: null, file_name: null, file_mime: null, file_size: null }).eq("id", id);
  if (error) throw new Error(pgMessage(error));
  await removeIfOrphan(entry.file_path);
  revalidatePath("/cari-hesap", "layout");
}

/** Cari hareketi (fatura / tahsilat) ve varsa dosyasını kalıcı siler; firmanın bakiyesi buna göre değişir. */
export async function deleteFirmLedgerEntry(fd: FormData): Promise<void> {
  await assertStaff("finance.manage");
  const id = str(fd, "id");
  if (!id || !UUID.test(id)) return;
  const supabase = await createClient();
  const { data: entry } = await supabase.from("firm_ledger_entries").select("file_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("firm_ledger_entries").delete().eq("id", id);
  if (error) throw new Error(pgMessage(error));
  if (entry?.file_path) await removeIfOrphan(entry.file_path);
  revalidatePath("/cari-hesap", "layout");
}
