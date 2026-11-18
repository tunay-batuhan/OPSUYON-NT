"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertStaff, getCurrentUser, hasPermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, validate } from "@/lib/form";
import { toMoney } from "@/lib/parse";
import { monthBounds } from "@/lib/payroll";
import {
  advanceSchema, linesSaveSchema, payRatesSchema,
  type AdvanceValues, type LinesSaveValues, type PayRatesValues,
} from "@/lib/schemas-payroll";
import type { ActionState } from "@/lib/action-types";

// Bordro ve maaş: yazma işlemleri KULLANICI oturumuyla yapılır (RLS + veritabanı tetikleyicileri karar verir);
// tutarları istemci göndermez, satır kaydedilirken veritabanı hesaplar.

const UUID = /^[0-9a-f-]{36}$/i;

async function actor() {
  const user = await getCurrentUser();
  if (!user || user.kind === "personnel") throw new Error("Bu işlem için yetkiniz yok.");
  return user;
}

function refresh() {
  revalidatePath("/bordrolar/maas");
  revalidatePath("/bordrolar/avans");
  revalidatePath("/bordrolar/ucretler");
}

/** Yarım güne yuvarlar ve sınırlar (0–max). */
const halfDay = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(n * 2) / 2));

/**
 * Dönemde satırı olmayan personeli ekler: o ay projede görevli olan (atama ayla kesişen) herkes.
 * Puantaj tablosunda o ay için kayıt varsa eksik gün oradan gelir.
 */
async function addMissingLines(db: SupabaseClient, runId: string, projectId: string, year: number, month: number): Promise<number> {
  const admin = createAdminClient();
  const { start, end } = monthBounds(year, month);
  const [{ data: asg }, { data: existing }] = await Promise.all([
    admin
      .from("personnel_assignments")
      .select("personnel_id")
      .eq("project_id", projectId)
      .lte("start_date", end)
      .or(`end_date.is.null,end_date.gte.${start}`),
    db.from("payroll_lines").select("personnel_id").eq("run_id", runId),
  ]);
  const have = new Set(((existing ?? []) as { personnel_id: string }[]).map((r) => r.personnel_id));
  const missing = [...new Set(((asg ?? []) as { personnel_id: string }[]).map((a) => a.personnel_id))].filter((id) => !have.has(id));
  if (!missing.length) return 0;

  const [{ data: sheets }] = await Promise.all([
    admin.from("timesheets").select("personnel_id, absence_days").eq("project_id", projectId).eq("period_year", year).eq("period_month", month).in("personnel_id", missing),
  ]);
  const absOf = new Map(((sheets ?? []) as { personnel_id: string; absence_days: number }[]).map((r) => [r.personnel_id, Number(r.absence_days)]));

  const rows = missing.map((personnel_id) => {
    const missing_days = halfDay(absOf.get(personnel_id) ?? 0, 30);
    return { run_id: runId, personnel_id, missing_days };
  });
  const { error } = await db.from("payroll_lines").insert(rows);
  if (error) throw new Error(pgMessage(error));
  return rows.length;
}

/** "Bu ay için bordroyu başlat": dönem + o ay projede görevli personelin satırları. */
export async function startPayrollRun(input: { project_id: string; year: number; month: number }): Promise<ActionState> {
  return guard(async () => {
    await actor();
    const { project_id, year, month } = input ?? {};
    if (!UUID.test(project_id ?? "") || !Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      return { error: "Geçersiz istek." };
    }
    const db = await createClient();
    const { data: run, error } = await db.from("payroll_runs").insert({ project_id, period_year: year, period_month: month }).select("id").single();
    if (error) return { error: error.code === "23505" ? "Bu dönemin bordrosu zaten başlatılmış." : pgMessage(error) };
    const added = await addMissingLines(db, run.id, project_id, year, month);
    refresh();
    return {
      ok: true,
      message: added ? `Bordro başlatıldı: ${added} personel listelendi. Eksik günleri girip “Kaydet ve hesapla”ya basın.` : "Bordro başlatıldı ancak bu ay projede görevli personel yok.",
    };
  });
}

/** "Eksik personeli ekle": dönem başlatıldıktan sonra projeye atanan personel. */
export async function syncPayrollRun(runId: string): Promise<ActionState> {
  return guard(async () => {
    await actor();
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const { data: run } = await db.from("payroll_runs").select("id, project_id, period_year, period_month, status").eq("id", runId).maybeSingle();
    if (!run) return { error: "Dönem bulunamadı." };
    if (run.status === "approved") return { error: "Onaylı (kilitli) döneme personel eklenemez." };
    const added = await addMissingLines(db, run.id, run.project_id, run.period_year, run.period_month);
    refresh();
    return { ok: true, message: added ? `${added} personel eklendi.` : "Eksik personel yok; listede o ay projede görevli herkes var." };
  });
}

/** "Kaydet ve hesapla": değişen satırların girilen alanları. Kesintileri yalnızca merkez (payroll.manage) gönderir. */
export async function savePayrollLines(values: LinesSaveValues): Promise<ActionState> {
  return guard(async () => {
    const user = await actor();
    const v = validate(linesSaveSchema, values);
    if (!v.ok) return v.state;
    const canDeduct = user.kind === "staff" && hasPermission(user, "payroll.manage");
    const db = await createClient();

    let saved = 0;
    const errors: string[] = [];
    const rows = v.data.rows;
    for (let i = 0; i < rows.length; i += 10) {
      const chunk = rows.slice(i, i + 10);
      const res = await Promise.all(
        chunk.map((r) => {
          const patch: Record<string, unknown> = { missing_days: r.missing_days };
          if (canDeduct) {
            if (r.ihbar_deduction !== undefined) patch.ihbar_deduction = r.ihbar_deduction;
            if (r.bes_deduction !== undefined) patch.bes_deduction = r.bes_deduction;
            if (r.other_deduction !== undefined) patch.other_deduction = r.other_deduction;
            if (r.other_note !== undefined) patch.other_note = nul(r.other_note);
          }
          return db.from("payroll_lines").update(patch).eq("id", r.id).eq("run_id", v.data.run_id).select("id");
        }),
      );
      for (const r of res) {
        if (r.error) errors.push(pgMessage(r.error));
        else if (r.data?.length) saved++;
      }
    }
    refresh();
    if (errors.length) return { error: [...new Set(errors)].join(" ") };
    if (!saved) return { error: "Kaydedilemedi: bu dönemde değişiklik yetkiniz yok." };
    return { ok: true, message: `${saved} satır kaydedildi ve yeniden hesaplandı.` };
  });
}

/** "Onayla ve kilitle": önce her satır güncel avans ve ücretle yeniden hesaplanır, sonra dönem kilitlenir. */
export async function approvePayrollRun(runId: string): Promise<ActionState> {
  return guard(async () => {
    await actor();
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const { error: tErr } = await db.from("payroll_lines").update({ updated_at: new Date().toISOString() }).eq("run_id", runId);
    if (tErr) return { error: pgMessage(tErr) };
    const { data, error } = await db.from("payroll_runs").update({ status: "approved" }).eq("id", runId).eq("status", "draft").select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Onaylanamadı: dönem zaten onaylı ya da yetkiniz yok." };
    refresh();
    return { ok: true, message: "Bordro onaylandı ve kilitlendi. Personel bordrosunu telefonundan görebilir." };
  });
}

/** "Kilidi aç": yalnızca merkez (payroll.manage); veritabanı da denetler. */
export async function unlockPayrollRun(runId: string): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.manage");
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const { data, error } = await db.from("payroll_runs").update({ status: "draft" }).eq("id", runId).eq("status", "approved").select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Kilit açılamadı: dönem onaylı değil." };
    refresh();
    return { ok: true, message: "Kilit açıldı; dönem yeniden düzenlenebilir." };
  });
}

/** "Dönemi sil": yalnızca taslak (onaylı dönem silinemez). */
export async function deletePayrollRun(runId: string): Promise<ActionState> {
  return guard(async () => {
    await actor();
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const { data, error } = await db.from("payroll_runs").delete().eq("id", runId).eq("status", "draft").select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Silinemedi: dönem onaylı ya da yetkiniz yok." };
    refresh();
    return { ok: true, message: "Dönem silindi." };
  });
}

/* ------------------------------------------------------------------ */
/* Avanslar                                                            */
/* ------------------------------------------------------------------ */

export async function createAdvance(values: AdvanceValues): Promise<ActionState> {
  return guard(async () => {
    await actor();
    const v = validate(advanceSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const db = await createClient();
    const { error } = await db.from("pay_advances").insert({
      project_id: d.project_id,
      personnel_id: d.personnel_id,
      paid_on: d.paid_on,
      amount: toMoney(d.amount),
      note: nul(d.note),
    });
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: "Avans kaydedildi; o ayın maaşından düşülecek." };
  });
}

export async function deleteAdvance(id: string): Promise<ActionState> {
  return guard(async () => {
    await actor();
    if (!UUID.test(id ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const { data, error } = await db.from("pay_advances").delete().eq("id", id).select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Silinemedi: kayıt bulunamadı ya da yetkiniz yok." };
    refresh();
    return { ok: true, message: "Avans silindi." };
  });
}

/* ------------------------------------------------------------------ */
/* Ücret tanımları (yalnızca merkez)                                   */
/* ------------------------------------------------------------------ */

export async function savePayRates(values: PayRatesValues): Promise<ActionState> {
  return guard(async () => {
    const user = await assertStaff("payroll.manage");
    const v = validate(payRatesSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;
    const m = (s: string) => toMoney(s) ?? 0;
    const db = await createClient();
    const { error } = await db.from("pay_rates").upsert(
      {
        personnel_id: d.personnel_id,
        net_salary: m(d.net_salary),
        transport_monthly: m(d.transport_monthly),
        overtime_monthly: m(d.overtime_monthly),
        meal_monthly: m(d.meal_monthly),
        // eski günlük alanlar (18 Kasım öncesi) kullanılmıyor
        overtime_daily: 0,
        meal_daily: 0,
        extra_monthly: m(d.extra_monthly),
        extra_label: nul(d.extra_label),
        updated_by: user.id,
      },
      { onConflict: "personnel_id" },
    );
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: "Ücret tanımı kaydedildi. Taslak bordrolar yeniden hesaplandı." };
  });
}
