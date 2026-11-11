"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, str, validate } from "@/lib/form";
import { toNumber } from "@/lib/parse";
import { LEAVE_TYPE_LABELS } from "@/lib/format";
import { leaveDeducts, legalAnnualLeaveDays } from "@/lib/leave-law";
import { EMPTY_FILE, leaveRecordDocSchema, type LeaveRecordDocValues } from "@/lib/schemas-ops";
import type { ActionState } from "@/lib/action-types";

const UUID = /^[0-9a-f-]{36}$/i;
const BUCKET = "documents";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Bakiyeden düşen (yıllık) izin kaydedilince o yılın bakiye satırı yoksa yasal hak (İş K. md. 53)
 * ile oluşturulur; böylece "Kalan izin" hesaplanabilir. İşe giriş tarihi yoksa satır açılmaz
 * (merkez bakiyeyi elle girer). Var olan satıra dokunulmaz.
 */
async function ensureAnnualBalance(supabase: Db, personnelId: string, startDate: string): Promise<void> {
  const year = Number(startDate.slice(0, 4));
  const { data: existing } = await supabase.from("leave_balances").select("id").eq("personnel_id", personnelId).eq("year", year).maybeSingle();
  if (existing) return;
  const { data: p } = await supabase.from("personnel").select("hire_date, birth_date").eq("id", personnelId).maybeSingle();
  if (!p?.hire_date) return;
  // hak, iznin başladığı gündeki kıdem ve yaşa göre
  const { days, reason } = legalAnnualLeaveDays(p.hire_date as string, p.birth_date as string | null, new Date(startDate));
  await supabase
    .from("leave_balances")
    .upsert(
      { personnel_id: personnelId, year, entitled_days: days, carried_days: 0, used_days: 0, metadata: { auto: true, reason } },
      { onConflict: "personnel_id,year", ignoreDuplicates: true },
    );
}

/**
 * İzin kaydı. Formdan dosya alanları (storage_path, file_name, mime_type, size_bytes) gelirse
 * imzalı izin evrakı da belge olarak kaydedilip izne bağlanır — tek seferde.
 */
export async function createLeaveRecord(values: LeaveRecordDocValues): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("leaves.manage");
    const v = validate(leaveRecordDocSchema, { ...EMPTY_FILE, ...values });
    if (!v.ok) return v.state;
    const d = v.data;

    const [personnel_id, project_id] = d.assignment.split("|");
    if (!UUID.test(personnel_id ?? "") || !UUID.test(project_id ?? "")) return { error: "Personel seçimi geçersiz.", fieldErrors: { assignment: "Geçersiz seçim" } };

    const supabase = await createClient();
    const dropFile = () => createAdminClient().storage.from(BUCKET).remove([d.storage_path]);

    // 1) evrak (varsa): önce belge, böylece izin kaydı doğrudan bağlanır
    let document_id: string | null = null;
    if (d.storage_path) {
      if (!d.storage_path.startsWith(`${project_id}/yillik_izin/`)) return { error: "Geçersiz dosya yolu." };
      const { data: doc, error } = await supabase
        .from("documents")
        .insert({
          project_id,
          personnel_id,
          category_code: "yillik_izin",
          title: `${LEAVE_TYPE_LABELS[d.leave_type] ?? "İzin"} evrakı (${d.start_date.split("-").reverse().join(".")})`,
          storage_path: d.storage_path,
          file_name: d.file_name,
          mime_type: nul(d.mime_type),
          size_bytes: toNumber(d.size_bytes),
          customer_visible: true,
          uploaded_by: actor.id,
        })
        .select("id")
        .single();
      if (error) {
        await dropFile();
        return { error: pgMessage(error) };
      }
      document_id = doc.id as string;
    }

    // 2) izin kaydı
    const { error } = await supabase.from("leave_records").insert({
      personnel_id,
      project_id,
      leave_type: d.leave_type,
      start_date: d.start_date,
      end_date: d.end_date,
      return_date: d.return_date,
      days: toNumber(d.days),
      note: nul(d.note),
      document_id,
      created_by: actor.id,
    });
    if (error) {
      if (document_id) {
        await supabase.from("documents").delete().eq("id", document_id);
        await dropFile();
      }
      return { error: pgMessage(error) };
    }

    // 3) yıllık izin bakiyesi (yoksa yasal hakla açılır)
    if (leaveDeducts(d.leave_type)) await ensureAnnualBalance(supabase, personnel_id, d.start_date);

    revalidatePath("/izinler");
    revalidatePath("/izinler/ekle"); // formdaki "kalan izin" kutusu güncel olsun
    return { ok: true, message: document_id ? "İzin ve imzalı evrak kaydedildi." : "İzin kaydedildi." };
  });
}

export async function deleteLeaveRecord(fd: FormData): Promise<void> {
  await assertStaff("leaves.manage");
  const id = str(fd, "id");
  if (!id || !UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("leave_records").delete().eq("id", id);
  revalidatePath("/izinler");
}

/** İzin evrakı: dosya zaten Storage'a yüklendi; belge kaydını oluşturup izne bağlar. */
export async function attachLeaveDocument(input: {
  recordId: string; path: string; fileName: string; mimeType: string; size: number;
}): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("leaves.manage");
    if (!UUID.test(input.recordId) || !input.path || !input.fileName) return { error: "Geçersiz istek." };

    const supabase = await createClient();
    const { data: rec } = await supabase.from("leave_records").select("id, personnel_id, project_id, start_date").eq("id", input.recordId).maybeSingle();
    if (!rec || !rec.project_id) return { error: "İzin kaydı bulunamadı." };
    if (!input.path.startsWith(`${rec.project_id}/`)) return { error: "Geçersiz dosya yolu." };

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        project_id: rec.project_id,
        personnel_id: rec.personnel_id,
        category_code: "yillik_izin",
        title: `İzin evrakı (${rec.start_date})`,
        storage_path: input.path,
        file_name: input.fileName,
        mime_type: nul(input.mimeType),
        size_bytes: input.size,
        customer_visible: true,
        uploaded_by: actor.id,
      })
      .select("id")
      .single();
    if (error) return { error: pgMessage(error) };

    const { error: uErr } = await supabase.from("leave_records").update({ document_id: doc.id }).eq("id", rec.id);
    if (uErr) return { error: pgMessage(uErr) };
    revalidatePath("/izinler");
    return { ok: true, message: "Evrak yüklendi." };
  });
}

const dayNum = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : toNumber(String(v ?? ""));
  return n === null || !Number.isFinite(n) || n < 0 || n > max ? null : Math.round(n * 100) / 100;
};

/**
 * Yönetici müdahalesi: bir izin kaydının gün sayısını elle düzeltir (resmi tatil, yarım gün, vardiya gibi
 * sistemin bilemeyeceği durumlar). Bakiyeden bu sayı düşer.
 */
export async function updateLeaveDays(input: { id: string; days: string | number }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("leaves.manage");
    if (!UUID.test(input.id ?? "")) return { error: "Geçersiz kayıt." };
    const days = dayNum(input.days, 365);
    if (days === null || days < 0.5) return { error: "Gün sayısı 0,5 ile 365 arasında olmalı." };
    const supabase = await createClient();
    const { data, error } = await supabase.from("leave_records").update({ days }).eq("id", input.id).select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "İzin kaydı bulunamadı veya değiştirme yetkiniz yok." };
    revalidatePath("/izinler", "layout");
    revalidatePath("/personel", "layout");
    return { ok: true, message: "Gün sayısı güncellendi." };
  });
}

/**
 * Yönetici müdahalesi: yıllık izin bakiyesini elle düzeltir. Kalan = hak edilen + devreden − elle düşülen −
 * o yıl kaydedilmiş yıllık izin günleri. Sözleşmeyle fazla hak, devreden izin, sistem dışı kullanım gibi
 * durumlar buradan işlenir; kim/ne zaman düzeltti bilgisi satırın metadata alanında ve işlem geçmişinde kalır.
 */
export async function updateLeaveBalance(input: {
  id: string; entitled: string | number; carried: string | number; used: string | number; note?: string;
}): Promise<ActionState> {
  return guard(async () => {
    const actor = await assertStaff("leaves.manage");
    if (!UUID.test(input.id ?? "")) return { error: "Geçersiz kayıt." };
    const entitled = dayNum(input.entitled, 365);
    const carried = dayNum(input.carried, 365);
    const used = dayNum(input.used, 365);
    if (entitled === null || carried === null || used === null) return { error: "Gün alanları 0 ile 365 arasında sayı olmalı (yarım gün için 0,5)." };
    const note = String(input.note ?? "").trim().slice(0, 200);

    const supabase = await createClient();
    const { data: row } = await supabase.from("leave_balances").select("metadata").eq("id", input.id).maybeSingle();
    if (!row) return { error: "Bakiye bulunamadı." };
    const metadata = {
      ...((row.metadata as Record<string, unknown> | null) ?? {}),
      auto: false,
      manual: true,
      manual_by: actor.full_name,
      manual_at: new Date().toISOString(),
      ...(note ? { manual_note: note } : {}),
    };
    const { data, error } = await supabase
      .from("leave_balances")
      .update({ entitled_days: entitled, carried_days: carried, used_days: used, metadata })
      .eq("id", input.id)
      .select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Bakiye değiştirilemedi (yetki)." };
    revalidatePath("/izinler", "layout");
    revalidatePath("/personel", "layout");
    return { ok: true, message: "Bakiye güncellendi." };
  });
}

/** Resmi tatil ekle (İzin Yönetimi > Resmi tatiller): yıllık izin günü önerisinde bu günler sayılmaz. */
export async function addHoliday(input: { day: string; name: string; half: boolean }): Promise<ActionState> {
  return guard(async (): Promise<ActionState> => {
    await assertStaff("leaves.manage");
    const day = String(input.day ?? "");
    const name = String(input.name ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Tarih seçin.", fieldErrors: { day: "Tarih seçin" } };
    if (name.length < 2 || name.length > 80) return { error: "Tatilin adını yazın (en fazla 80 karakter).", fieldErrors: { name: "Ad yazın" } };
    const supabase = await createClient();
    const { error } = await supabase.from("public_holidays").insert({ day, name, half: Boolean(input.half) });
    if (error) return { error: error.code === "23505" ? "Bu tarih zaten listede. Değiştirmek için önce silin." : pgMessage(error) };
    revalidatePath("/izinler", "layout");
    return { ok: true, message: "Resmi tatil eklendi." };
  });
}

export async function deleteHoliday(fd: FormData): Promise<void> {
  await assertStaff("leaves.manage");
  const id = str(fd, "id");
  if (!id || !UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("public_holidays").delete().eq("id", id);
  revalidatePath("/izinler", "layout");
}
