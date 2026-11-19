"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertStaff, getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { guard, nul, pgMessage, validate } from "@/lib/form";
import { toMoney } from "@/lib/parse";
import { loadTemplate, monthBounds, rateVarsFor } from "@/lib/payroll";
import { computeRow, initialCells, normalizeTemplate, validateTemplate, type Cells, type PayCol } from "@/lib/payroll-engine";
import {
  advanceSchema, linesSaveSchema, payRatesSchema,
  type AdvanceValues, type LinesSaveValues, type PayRatesValues,
} from "@/lib/schemas-payroll";
import type { ActionState } from "@/lib/action-types";

// Bordro ve maaş. Maaş tablosunu MERKEZ hazırlar (payroll.run); site yönetimi bordroyu onaylanıp kilitlendikten sonra
// görür. Yazma kullanıcı oturumuyla yapılır (RLS). Tutarları istemci göndermez: sunucu, dönemin şablonuyla hesaplar.

const UUID = /^[0-9a-f-]{36}$/i;

/** Avans gibi müşterinin de yapabildiği işlemler: personel hesabı dışındaki oturum. */
async function actor() {
  const user = await getCurrentUser();
  if (!user || user.kind === "personnel") throw new Error("Bu işlem için yetkiniz yok.");
  return user;
}

function refresh() {
  revalidatePath("/bordrolar", "layout");
}

type Run = { id: string; project_id: string; period_year: number; period_month: number; status: string; template: unknown };

async function readRun(db: SupabaseClient, runId: string): Promise<Run | null> {
  const { data } = await db.from("payroll_runs").select("id, project_id, period_year, period_month, status, template").eq("id", runId).maybeSingle();
  return (data as Run | null) ?? null;
}

async function runColumns(run: Run): Promise<PayCol[]> {
  const cols = normalizeTemplate(run.template);
  return cols && validateTemplate(cols).length === 0 ? cols : (await loadTemplate(run.project_id)).columns;
}

/**
 * Dönemde satırı olmayan personeli ekler: o ay projede görevli olan (atama ayla kesişen) herkes. Giriş sütunlarının
 * ilk değerleri ücret tanımından gelir; puantajda o ay devamsızlık varsa "gun" sütunu 30 − devamsızlık olur.
 */
async function addMissingLines(db: SupabaseClient, run: Run, cols: PayCol[]): Promise<number> {
  const admin = createAdminClient();
  const { start, end } = monthBounds(run.period_year, run.period_month);
  const [{ data: asg }, { data: existing }] = await Promise.all([
    admin.from("personnel_assignments").select("personnel_id").eq("project_id", run.project_id).lte("start_date", end).or(`end_date.is.null,end_date.gte.${start}`),
    db.from("payroll_lines").select("personnel_id").eq("run_id", run.id),
  ]);
  const have = new Set(((existing ?? []) as { personnel_id: string }[]).map((r) => r.personnel_id));
  const missing = [...new Set(((asg ?? []) as { personnel_id: string }[]).map((a) => a.personnel_id))].filter((id) => !have.has(id));
  if (!missing.length) return 0;
  const [vars, { data: sheets }] = await Promise.all([
    rateVarsFor(run.project_id, run.period_year, run.period_month, missing),
    admin.from("timesheets").select("personnel_id, absence_days").eq("project_id", run.project_id).eq("period_year", run.period_year).eq("period_month", run.period_month).in("personnel_id", missing),
  ]);
  const absOf = new Map(((sheets ?? []) as { personnel_id: string; absence_days: number }[]).map((r) => [r.personnel_id, Number(r.absence_days)]));
  const hasGun = cols.some((c) => c.code === "gun" && c.kind === "input");
  const rows = missing.map((personnel_id) => {
    const cells: Cells = initialCells(cols, vars.get(personnel_id)?.vars ?? {});
    const abs = absOf.get(personnel_id) ?? 0;
    if (hasGun && abs > 0) cells.gun = Math.max(0, 30 - abs);
    return { run_id: run.id, personnel_id, cells };
  });
  const { error } = await db.from("payroll_lines").insert(rows);
  if (error) throw new Error(pgMessage(error));
  return rows.length;
}

/** "Bu ay için bordroyu başlat": dönem (şablonun kopyasıyla) + o ay projede görevli personelin satırları. Merkez. */
export async function startPayrollRun(input: { project_id: string; year: number; month: number }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.run");
    const { project_id, year, month } = input ?? {};
    if (!UUID.test(project_id ?? "") || !Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      return { error: "Geçersiz istek." };
    }
    const db = await createClient();
    const { columns } = await loadTemplate(project_id);
    const { data: created, error } = await db.from("payroll_runs").insert({ project_id, period_year: year, period_month: month, template: columns }).select("id").single();
    if (error) return { error: error.code === "23505" ? "Bu dönemin bordrosu zaten başlatılmış." : pgMessage(error) };
    const added = await addMissingLines(db, { id: created.id, project_id, period_year: year, period_month: month, status: "draft", template: columns }, columns);
    refresh();
    return {
      ok: true,
      message: added ? `Bordro başlatıldı: ${added} personel listelendi. Günleri ve değerleri kontrol edip “Kaydet ve hesapla”ya basın.` : "Bordro başlatıldı ancak bu ay projede görevli personel yok.",
    };
  });
}

/** "Eksik personeli ekle": dönem başlatıldıktan sonra projeye atanan personel. */
export async function syncPayrollRun(runId: string): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.run");
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const run = await readRun(db, runId);
    if (!run) return { error: "Dönem bulunamadı." };
    if (run.status === "approved") return { error: "Onaylı (kilitli) döneme personel eklenemez." };
    const added = await addMissingLines(db, run, await runColumns(run));
    refresh();
    return { ok: true, message: added ? `${added} personel eklendi.` : "Eksik personel yok; listede o ay projede görevli herkes var." };
  });
}

/**
 * "Kaydet ve hesapla": değişen satırların hücreleri. Sayı → giriş değeri ya da formülün elle ezilmesi; null → formüle /
 * ilk değere dön; metin → not sütunu. Şablonda olmayan kodlar yok sayılır. Merkez.
 */
export async function savePayrollLines(values: LinesSaveValues): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.run");
    const v = validate(linesSaveSchema, values);
    if (!v.ok) return v.state;
    const db = await createClient();
    const run = await readRun(db, v.data.run_id);
    if (!run) return { error: "Dönem bulunamadı." };
    if (run.status === "approved") return { error: "Bu dönemin bordrosu onaylandı (kilitli). Değişiklik için önce kilidi açın." };
    const cols = new Map((await runColumns(run)).map((c) => [c.code, c]));
    const ids = v.data.rows.map((r) => r.id);
    const { data: existing } = await db.from("payroll_lines").select("id, cells").eq("run_id", run.id).in("id", ids);
    const cellsOf = new Map(((existing ?? []) as { id: string; cells: Cells | null }[]).map((r) => [r.id, r.cells ?? {}]));

    let saved = 0;
    const errors: string[] = [];
    for (let i = 0; i < v.data.rows.length; i += 10) {
      const res = await Promise.all(
        v.data.rows.slice(i, i + 10).map((r) => {
          if (!cellsOf.has(r.id)) return Promise.resolve({ data: null, error: null });
          const cells: Cells = { ...cellsOf.get(r.id) };
          for (const [code, val] of Object.entries(r.cells)) {
            const col = cols.get(code);
            if (!col) continue;
            if (val === null) delete cells[code];
            else if (col.kind === "text") { if (typeof val === "string") { const t = val.trim(); if (t) cells[code] = t; else delete cells[code]; } }
            else if (typeof val === "number") cells[code] = Math.round(val * 100) / 100;
          }
          return db.from("payroll_lines").update({ cells }).eq("id", r.id).eq("run_id", run.id).select("id");
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

/**
 * "Onayla ve kilitle": her satır güncel ücret tanımı ve avanslarla son kez hesaplanır; sonuçlar ve o anki değişkenler
 * satıra dondurulur, sonra dönem kilitlenir. Kilitli bordroyu site yönetimi görür.
 */
export async function approvePayrollRun(runId: string): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.run");
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const run = await readRun(db, runId);
    if (!run) return { error: "Dönem bulunamadı." };
    if (run.status !== "draft") return { error: "Dönem zaten onaylı." };
    const cols = await runColumns(run);
    const { data: rows } = await db.from("payroll_lines").select("id, personnel_id, cells").eq("run_id", run.id).limit(2000);
    const lines = (rows ?? []) as { id: string; personnel_id: string; cells: Cells | null }[];
    const vars = await rateVarsFor(run.project_id, run.period_year, run.period_month, lines.map((l) => l.personnel_id));
    for (let i = 0; i < lines.length; i += 10) {
      const res = await Promise.all(
        lines.slice(i, i + 10).map((l) => {
          const vv = vars.get(l.personnel_id)?.vars ?? {};
          const r = computeRow(cols, l.cells ?? {}, vv);
          const calc = Object.fromEntries(Object.entries(r.values).map(([k, n]) => [k, Math.round(n * 10000) / 10000]));
          return db.from("payroll_lines").update({ calc, vars: vv }).eq("id", l.id).eq("run_id", run.id);
        }),
      );
      const bad = res.find((r) => r.error);
      if (bad?.error) return { error: pgMessage(bad.error) };
    }
    const { data, error } = await db.from("payroll_runs").update({ status: "approved", template: cols }).eq("id", runId).eq("status", "draft").select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Onaylanamadı: dönem zaten onaylı ya da yetkiniz yok." };
    refresh();
    return { ok: true, message: "Bordro onaylandı ve kilitlendi. Site yönetimi bordroyu artık görebilir." };
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
    return { ok: true, message: "Kilit açıldı; dönem yeniden düzenlenebilir. Site yönetimi yeniden onaylanana kadar göremez." };
  });
}

/** "Dönemi sil": yalnızca taslak (onaylı dönem silinemez). */
export async function deletePayrollRun(runId: string): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.run");
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const { data, error } = await db.from("payroll_runs").delete().eq("id", runId).eq("status", "draft").select("id");
    if (error) return { error: pgMessage(error) };
    if (!data?.length) return { error: "Silinemedi: dönem onaylı ya da yetkiniz yok." };
    refresh();
    return { ok: true, message: "Dönem silindi." };
  });
}

/** "Şablonu yenile": taslak dönemin sütun ve formüllerini projenin güncel şablonuyla değiştirir (girilen hücreler kalır). */
export async function refreshRunTemplate(runId: string): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.run");
    if (!UUID.test(runId ?? "")) return { error: "Geçersiz istek." };
    const db = await createClient();
    const run = await readRun(db, runId);
    if (!run) return { error: "Dönem bulunamadı." };
    if (run.status !== "draft") return { error: "Onaylı dönemin şablonu değişmez; önce kilidi açın." };
    const { columns } = await loadTemplate(run.project_id);
    const { error } = await db.from("payroll_runs").update({ template: columns }).eq("id", runId);
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: "Dönem, güncel şablonun sütun ve formülleriyle yeniden hesaplandı." };
  });
}

/* ------------------------------------------------------------------ */
/* Bordro şablonu (yalnızca merkez: payroll.manage)                    */
/* ------------------------------------------------------------------ */

/** Şablonu kaydeder: project_id boşsa VARSAYILAN şablon (özel şablonu olmayan tüm projeler), doluysa o projeye özel. */
export async function savePayrollTemplate(input: { project_id: string | null; columns: PayCol[] }): Promise<ActionState> {
  return guard(async () => {
    const user = await assertStaff("payroll.manage");
    const projectId = input?.project_id || null;
    if (projectId && !UUID.test(projectId)) return { error: "Geçersiz proje." };
    const cols = normalizeTemplate(input?.columns);
    if (!cols) return { error: "Şablonda en az bir sütun olmalı." };
    const errs = validateTemplate(cols);
    if (errs.length) return { error: errs.join("\n") };
    const db = await createClient();
    const q = db.from("payroll_templates").select("id");
    const { data: existing } = await (projectId ? q.eq("project_id", projectId) : q.is("project_id", null)).maybeSingle();
    const { error } = existing
      ? await db.from("payroll_templates").update({ columns: cols, updated_by: user.id }).eq("id", existing.id)
      : await db.from("payroll_templates").insert({ project_id: projectId, columns: cols, updated_by: user.id });
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: "Şablon kaydedildi. Yeni başlatılan dönemler bu şablonu kullanır; açık taslak dönemlerde “Şablonu yenile”ye basın." };
  });
}

/** Projeye özel şablonu siler (proje varsayılan şablona döner) ya da kayıtlı varsayılanı siler (hazır şablona döner). */
export async function resetPayrollTemplate(input: { project_id: string | null }): Promise<ActionState> {
  return guard(async () => {
    await assertStaff("payroll.manage");
    const projectId = input?.project_id || null;
    if (projectId && !UUID.test(projectId)) return { error: "Geçersiz proje." };
    const db = await createClient();
    const q = db.from("payroll_templates").delete();
    const { error } = await (projectId ? q.eq("project_id", projectId) : q.is("project_id", null));
    if (error) return { error: pgMessage(error) };
    refresh();
    return { ok: true, message: projectId ? "Projeye özel şablon silindi; proje varsayılan şablonu kullanır." : "Varsayılan şablon hazır (Excel) düzenine döndü." };
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
        support_monthly: m(d.support_monthly),
        bes_monthly: m(d.bes_monthly),
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
    return { ok: true, message: "Ücret tanımı kaydedildi. Taslak bordrolar güncel tanımla hesaplanır; onaylı bordrolar değişmez." };
  });
}
