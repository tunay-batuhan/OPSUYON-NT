import "server-only";
import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidIban, isValidTckn, normalizeIban, toNumber } from "@/lib/parse";
import { IMPORT_DEFS, MONTH_NAMES, normKey, type ImportDef, type ImportType } from "@/lib/import/defs";

export const MAX_ROWS = 2000;

export type RowResult = { row: number; title: string; summary: string; errors: string[]; warnings: string[] };
export type ImportReport = {
  type: ImportType;
  sheet: string;
  headerRow: number;
  recognized: { label: string; header: string }[];
  missingRequired: string[];
  unknownHeaders: string[];
  rows: RowResult[];
  total: number;
  ok: number;
  failed: number;
  applied?: number;
  truncated: boolean;
};

type Parsed = {
  sheet: string;
  headerRow: number;
  recognized: { key: string; label: string; header: string }[];
  unknownHeaders: string[];
  rows: { row: number; v: Record<string, string> }[];
  truncated: boolean;
};

/* ------------------------------ reading the workbook ------------------------------ */
function cellText(v: ExcelJS.CellValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text).trim();
    return "";
  }
  return String(v).trim();
}

export async function parseWorkbook(buffer: ArrayBuffer, def: ImportDef): Promise<Parsed> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const aliasMap = new Map<string, string>(); // normalized header → column key
  for (const c of def.columns) {
    aliasMap.set(normKey(c.label), c.key);
    c.aliases.forEach((a) => aliasMap.set(normKey(a), c.key));
  }

  let best: { ws: ExcelJS.Worksheet; row: number; cols: Map<string, number>; matches: number } | null = null;
  for (const ws of wb.worksheets) {
    const limit = Math.min(ws.rowCount, 15);
    for (let r = 1; r <= limit; r++) {
      const cols = new Map<string, number>();
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const key = aliasMap.get(normKey(cellText(cell.value)));
        if (key && !cols.has(key)) cols.set(key, colNumber);
      });
      if (cols.size >= 2 && (!best || cols.size > best.matches)) best = { ws, row: r, cols, matches: cols.size };
    }
  }
  if (!best) {
    throw new Error("Başlık satırı tanınamadı. Şablondaki sütun başlıklarını kullanın (örn. " + def.columns.slice(0, 3).map((c) => c.label).join(", ") + ").");
  }

  const headerCells = new Map<number, string>();
  best.ws.getRow(best.row).eachCell({ includeEmpty: false }, (cell, n) => headerCells.set(n, cellText(cell.value)));
  const usedCols = new Set(best.cols.values());
  const unknownHeaders = [...headerCells.entries()].filter(([n, h]) => h && !usedCols.has(n)).map(([, h]) => h);
  const recognized = def.columns
    .filter((c) => best!.cols.has(c.key))
    .map((c) => ({ key: c.key, label: c.label, header: headerCells.get(best!.cols.get(c.key)!) ?? c.label }));

  const rows: Parsed["rows"] = [];
  let truncated = false;
  for (let r = best.row + 1; r <= best.ws.rowCount; r++) {
    const wsRow = best.ws.getRow(r);
    const v: Record<string, string> = {};
    let any = false;
    for (const [key, col] of best.cols) {
      v[key] = cellText(wsRow.getCell(col).value);
      if (v[key]) any = true;
    }
    if (!any) continue;
    if (rows.length >= MAX_ROWS) { truncated = true; break; }
    rows.push({ row: r, v });
  }
  return { sheet: best.ws.name, headerRow: best.row, recognized, unknownHeaders, rows, truncated };
}

/* ------------------------------ value helpers ------------------------------ */
function parseDateStr(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
function parseMonth(s: string): number | null {
  if (!s) return null;
  const n = toNumber(s);
  if (n !== null) return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
  return MONTH_NAMES[normKey(s)] ?? null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;

type Person = { id: string; full_name: string; employee_no: string | null };

function findPerson(pool: Person[], employeeNo: string, fullName: string): { person?: Person; error?: string } {
  if (employeeNo) {
    const hit = pool.find((p) => p.employee_no && normKey(p.employee_no) === normKey(employeeNo));
    if (hit) return { person: hit };
    if (!fullName) return { error: `Sicil no "${employeeNo}" bu projede aktif görevli personelle eşleşmedi` };
  }
  if (fullName) {
    const hits = pool.filter((p) => normKey(p.full_name) === normKey(fullName));
    if (hits.length === 1) return { person: hits[0] };
    if (hits.length > 1) return { error: `"${fullName}" adıyla birden fazla personel var; Sicil No ekleyin` };
    return { error: `"${fullName}" bu projede aktif görevli personelle eşleşmedi` };
  }
  return { error: "Sicil No veya Ad Soyad girilmeli" };
}

type LedgerRow = { row_no: number; entry_date: string; ref_no: string | null; description: string | null; debit: number; credit: number; balance: number };
type Prepared = RowResult & { apply?: () => Promise<string | null>; ledger?: LedgerRow };

export type ImportOptions = { year?: number; month?: number };
type Ctx = {
  supabase: SupabaseClient;
  projectId: string;
  importId?: string;
  options: ImportOptions;
  canSensitive: boolean;
  fileName?: string;
  storagePath?: string | null;
  userId?: string;
};

/* ------------------------------ per-type preparation ------------------------------ */
async function assignedPeople(ctx: Ctx): Promise<Person[]> {
  const { data } = await ctx.supabase
    .from("personnel_assignments")
    .select("personnel(id, full_name, employee_no)")
    .eq("project_id", ctx.projectId)
    .is("end_date", null);
  return ((data ?? []) as unknown as { personnel: Person | null }[]).flatMap((r) => (r.personnel ? [r.personnel] : []));
}

function numField(v: Record<string, string>, key: string, label: string, min: number, max: number, errors: string[]): number {
  const raw = v[key];
  if (!raw) return 0;
  const n = toNumber(raw);
  if (n === null) { errors.push(`${label} sayı olmalı ("${raw}")`); return 0; }
  if (n < min || n > max) errors.push(`${label} ${min}-${max} arasında olmalı (${n})`);
  return n;
}

async function prepareTimesheet(rows: Parsed["rows"], ctx: Ctx): Promise<Prepared[]> {
  const pool = await assignedPeople(ctx);
  const seen = new Set<string>();
  return rows.map(({ row, v }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { person, error } = findPerson(pool, v.employee_no ?? "", v.full_name ?? "");
    if (error) errors.push(error);

    const yearN = v.year ? toNumber(v.year) : (ctx.options.year ?? null);
    const month = v.month ? parseMonth(v.month) : (ctx.options.month ?? null);
    if (yearN === null || !Number.isInteger(yearN) || yearN < 2000 || yearN > 2100) errors.push("Yıl geçersiz (dosyada yıl yoksa ekrandan dönemi seçin)");
    if (!month) errors.push("Ay geçersiz (dosyada ay yoksa ekrandan dönemi seçin)");

    const worked = numField(v, "worked_days", "Çalışılan gün", 0, 31, errors);
    const leave = numField(v, "leave_days", "İzin", 0, 31, errors);
    const absence = numField(v, "absence_days", "Devamsızlık", 0, 31, errors);
    const overtime = numField(v, "overtime_hours", "Fazla mesai", 0, 400, errors);
    if (!v.worked_days && !v.leave_days && !v.absence_days && !v.overtime_hours) warnings.push("Hiçbir gün/saat değeri yok; sıfır kaydedilir");

    const key = `${person?.id}-${yearN}-${month}`;
    if (person && seen.has(key)) warnings.push("Dosyada aynı personel ve dönem tekrar ediyor; sonraki satır önceki kaydı günceller");
    seen.add(key);

    const title = person?.full_name ?? v.full_name ?? v.employee_no ?? "—";
    return {
      row, title, errors, warnings,
      summary: `${month ?? "?"}/${yearN ?? "?"} · ${worked} gün · ${leave} izin · ${absence} devamsız · ${overtime} sa`,
      apply: async () => {
        const { error: e } = await ctx.supabase.from("timesheets").upsert(
          {
            project_id: ctx.projectId, personnel_id: person!.id, period_year: yearN, period_month: month,
            worked_days: worked, leave_days: leave, absence_days: absence, overtime_hours: overtime,
            note: v.note || null, import_id: ctx.importId ?? null,
          },
          { onConflict: "project_id,personnel_id,period_year,period_month" },
        );
        return e ? e.message : null;
      },
    };
  });
}

async function prepareLeave(rows: Parsed["rows"], ctx: Ctx): Promise<Prepared[]> {
  const pool = await assignedPeople(ctx);
  return rows.map(({ row, v }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { person, error } = findPerson(pool, v.employee_no ?? "", v.full_name ?? "");
    if (error) errors.push(error);

    const yearN = v.year ? toNumber(v.year) : (ctx.options.year ?? null);
    if (yearN === null || !Number.isInteger(yearN) || yearN < 2000 || yearN > 2100) errors.push("Yıl geçersiz (dosyada yıl yoksa ekrandan yılı seçin)");
    const entitled = numField(v, "entitled_days", "Hak edilen", 0, 60, errors);
    const carried = numField(v, "carried_days", "Devreden", 0, 60, errors);
    const used = numField(v, "used_days", "Kullanılan", 0, 120, errors);
    if (!errors.length && used > entitled + carried) warnings.push(`Kullanılan (${used}) hak + devreden toplamını (${entitled + carried}) aşıyor`);

    return {
      row, title: person?.full_name ?? v.full_name ?? v.employee_no ?? "—", errors, warnings,
      summary: `${yearN ?? "?"} · hak ${entitled} · devreden ${carried} · kullanılan ${used} · kalan ${entitled + carried - used}`,
      apply: async () => {
        const { error: e } = await ctx.supabase.from("leave_balances").upsert(
          { personnel_id: person!.id, year: yearN, entitled_days: entitled, carried_days: carried, used_days: used },
          { onConflict: "personnel_id,year" },
        );
        return e ? e.message : null;
      },
    };
  });
}

async function preparePersonnel(rows: Parsed["rows"], ctx: Ctx): Promise<Prepared[]> {
  const [{ data: all }, { data: assigned }, { data: proj }] = await Promise.all([
    ctx.supabase.from("personnel").select("id, employee_no").not("employee_no", "is", null).limit(10000),
    ctx.supabase.from("personnel_assignments").select("personnel_id").eq("project_id", ctx.projectId).is("end_date", null),
    ctx.supabase.from("projects").select("organization_id").eq("id", ctx.projectId).maybeSingle(),
  ]);
  // Bir personel aynı anda yalnızca 1 projede olabilir: başka projede görevli olanlar bu projeye alınamaz
  const { data: elsewhereRows } = await ctx.supabase
    .from("personnel_assignments")
    .select("personnel_id, projects(name)")
    .is("end_date", null)
    .neq("project_id", ctx.projectId)
    .limit(10000);
  const busyElsewhere = new Map(((elsewhereRows ?? []) as unknown as { personnel_id: string; projects: { name: string } | null }[]).map((r) => [r.personnel_id, r.projects?.name ?? "başka bir proje"]));
  // Personel, projenin firmasının kadrosuna eklenir
  const orgId = (proj?.organization_id as string | undefined) ?? null;
  const byNo = new Map((all ?? []).map((p) => [normKey(p.employee_no as string), p.id as string]));
  const assignedIds = new Set((assigned ?? []).map((a) => a.personnel_id as string));
  const seenNo = new Set<string>();

  return rows.map(({ row, v }) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!v.first_name) errors.push("Ad zorunlu");
    if (!v.last_name) errors.push("Soyad zorunlu");
    if (v.email && !EMAIL_RE.test(v.email)) errors.push(`E-posta geçersiz ("${v.email}")`);
    if (v.phone && !PHONE_RE.test(v.phone)) errors.push(`Telefon geçersiz ("${v.phone}")`);
    const hire = v.hire_date ? parseDateStr(v.hire_date) : null;
    if (v.hire_date && !hire) errors.push(`İşe giriş tarihi geçersiz ("${v.hire_date}")`);
    if (v.national_id && !isValidTckn(v.national_id)) errors.push(`TC kimlik no geçersiz ("${v.national_id}")`);
    if (v.iban && !isValidIban(v.iban)) errors.push(`IBAN geçersiz ("${v.iban}")`);
    if ((v.national_id || v.iban) && !ctx.canSensitive) errors.push("TC / IBAN girmek için yetkiniz yok");

    const noKey = v.employee_no ? normKey(v.employee_no) : "";
    if (noKey && seenNo.has(noKey)) warnings.push("Dosyada aynı sicil no tekrar ediyor");
    if (noKey) seenNo.add(noKey);
    const existingId = noKey ? byNo.get(noKey) : undefined;
    const title = `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim() || "—";
    if (existingId && busyElsewhere.has(existingId)) errors.push(`Bu personel "${busyElsewhere.get(existingId)}" projesinde görevli; önce oradan çıkarın`);

    return {
      row, title, errors, warnings,
      summary: `${existingId ? "Güncellenecek" : "Yeni kayıt"}${v.title ? ` · ${v.title}` : ""}${existingId && assignedIds.has(existingId) ? " · zaten bu projede" : " · projeye atanacak"}`,
      apply: async () => {
        const fields: Record<string, string | null> = {
          first_name: v.first_name, last_name: v.last_name, employee_no: v.employee_no || null,
          title: v.title || null, phone: v.phone || null, email: v.email || null, hire_date: hire,
        };
        if (!existingId && orgId) fields.organization_id = orgId;
        let personId = existingId;
        if (personId) {
          const patch = Object.fromEntries(Object.entries(fields).filter(([k, val]) => val !== null || k === "first_name" || k === "last_name"));
          const { error: e } = await ctx.supabase.from("personnel").update(patch).eq("id", personId);
          if (e) return e.message;
        } else {
          const { data, error: e } = await ctx.supabase.from("personnel").insert(fields).select("id").single();
          if (e) return e.message;
          personId = data.id as string;
          if (noKey) byNo.set(noKey, personId);
        }
        if (v.national_id || v.iban) {
          const priv: Record<string, string> = { personnel_id: personId };
          if (v.national_id) priv.national_id = v.national_id;
          if (v.iban) priv.iban = normalizeIban(v.iban);
          const { error: e } = await ctx.supabase.from("personnel_private").upsert(priv, { onConflict: "personnel_id" });
          if (e) return e.message;
        }
        if (!assignedIds.has(personId)) {
          const { error: e } = await ctx.supabase.from("personnel_assignments").insert({
            personnel_id: personId, project_id: ctx.projectId, position: v.position || v.title || null, shift: v.shift || null,
          });
          if (e) return e.message;
          assignedIds.add(personId);
        }
        return null;
      },
    };
  });
}


async function prepareLedger(rows: Parsed["rows"], ctx: Ctx): Promise<Prepared[]> {
  void ctx;
  let running = 0;
  return rows.map(({ row, v }, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const date = parseDateStr(v.entry_date ?? "");
    if (!date) errors.push(v.entry_date ? `Tarih geçersiz ("${v.entry_date}")` : "Tarih zorunlu");
    const money = (key: string, label: string) => {
      const raw = v[key];
      if (!raw) return 0;
      const n = toNumber(raw);
      if (n === null) { errors.push(`${label} sayı olmalı ("${raw}")`); return 0; }
      if (n < 0) errors.push(`${label} negatif olamaz ("${raw}")`);
      return n;
    };
    const debit = money("debit", "Borç");
    const credit = money("credit", "Alacak");
    if (!v.debit && !v.credit && !v.balance) errors.push("Borç, Alacak veya Bakiye değerlerinden en az biri gerekli");

    let balance = running + debit - credit;
    if (v.balance) {
      const b = toNumber(v.balance);
      if (b === null) errors.push(`Bakiye sayı olmalı ("${v.balance}")`);
      else balance = b;
    }
    if (!errors.length) running = balance;
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      row,
      title: `${date ? v.entry_date : "—"}${v.ref_no ? ` · ${v.ref_no}` : ""}`,
      errors,
      warnings,
      summary: `${v.description ?? ""} · borç ${debit} · alacak ${credit} · bakiye ${round(balance)}`,
      ledger: { row_no: i + 1, entry_date: date ?? "", ref_no: v.ref_no || null, description: v.description || null, debit: round(debit), credit: round(credit), balance: round(balance) },
    };
  });
}

/** Replaces the project's current statement; the LAST row's balance becomes the current balance. */
async function commitLedger(prepared: Prepared[], ctx: Ctx): Promise<number> {
  const entries = prepared.map((p) => p.ledger!).filter(Boolean);
  if (!entries.length) throw new Error("Aktarılacak satır yok.");
  const last = entries[entries.length - 1];

  const { data: prev } = await ctx.supabase.from("ledger_statements").select("id").eq("project_id", ctx.projectId).eq("is_current", true).maybeSingle();
  if (prev) {
    const { error } = await ctx.supabase.from("ledger_statements").update({ is_current: false }).eq("id", prev.id);
    if (error) throw new Error(error.message);
  }
  const { data: st, error: sErr } = await ctx.supabase
    .from("ledger_statements")
    .insert({
      project_id: ctx.projectId, file_name: ctx.fileName ?? "ekstre.xlsx", storage_path: ctx.storagePath ?? null,
      row_count: entries.length, closing_balance: last.balance, as_of_date: last.entry_date, is_current: true, created_by: ctx.userId ?? null,
    })
    .select("id")
    .single();
  if (sErr || !st) {
    if (prev) await ctx.supabase.from("ledger_statements").update({ is_current: true }).eq("id", prev.id);
    throw new Error(sErr?.message ?? "Ekstre kaydedilemedi.");
  }
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500).map((e) => ({ ...e, statement_id: st.id, project_id: ctx.projectId }));
    const { error } = await ctx.supabase.from("ledger_entries").insert(chunk);
    if (error) {
      await ctx.supabase.from("ledger_statements").delete().eq("id", st.id);
      if (prev) await ctx.supabase.from("ledger_statements").update({ is_current: true }).eq("id", prev.id);
      throw new Error(error.message);
    }
  }
  return entries.length;
}

/* ------------------------------ public API ------------------------------ */
export async function runImport(args: {
  type: ImportType;
  buffer: ArrayBuffer;
  mode: "preview" | "commit";
  ctx: Ctx;
}): Promise<ImportReport> {
  const def = IMPORT_DEFS[args.type];
  const parsed = await parseWorkbook(args.buffer, def);

  const missingRequired = def.columns.filter((c) => c.required && !parsed.recognized.some((r) => r.key === c.key)).map((c) => c.label);
  const base: ImportReport = {
    type: args.type, sheet: parsed.sheet, headerRow: parsed.headerRow,
    recognized: parsed.recognized.map(({ label, header }) => ({ label, header })),
    missingRequired, unknownHeaders: parsed.unknownHeaders, rows: [], total: parsed.rows.length, ok: 0, failed: 0, truncated: parsed.truncated,
  };
  if (missingRequired.length) throw new Error(`Zorunlu sütun(lar) eksik: ${missingRequired.join(", ")}`);
  if (!parsed.rows.length) throw new Error("Başlık satırının altında veri satırı bulunamadı.");

  const prepared =
    args.type === "timesheet" ? await prepareTimesheet(parsed.rows, args.ctx)
    : args.type === "leave" ? await prepareLeave(parsed.rows, args.ctx)
    : args.type === "ledger" ? await prepareLedger(parsed.rows, args.ctx)
    : await preparePersonnel(parsed.rows, args.ctx);

  let applied = 0;
  if (args.type === "ledger") {
    const bad = prepared.filter((p) => p.errors.length).length;
    if (args.mode === "commit") {
      if (bad) throw new Error(`Ekstrede ${bad} hatalı satır var. Bakiyenin doğru olması için tüm satırlar geçerli olmalı; dosyayı düzeltip yeniden yükleyin.`);
      applied = await commitLedger(prepared, args.ctx);
    }
    base.rows = prepared.map((p) => ({ row: p.row, title: p.title, summary: p.summary, errors: p.errors, warnings: p.warnings }));
    base.failed = bad;
    base.ok = base.rows.length - bad;
    if (args.mode === "commit") base.applied = applied;
    return base;
  }
  for (const p of prepared) {
    if (!p.errors.length && args.mode === "commit" && p.apply) {
      const err = await p.apply();
      if (err) p.errors.push(`Kaydedilemedi: ${err}`);
      else applied++;
    }
    base.rows.push({ row: p.row, title: p.title, summary: p.summary, errors: p.errors, warnings: p.warnings });
  }
  base.failed = base.rows.filter((r) => r.errors.length).length;
  base.ok = base.rows.length - base.failed;
  if (args.mode === "commit") base.applied = applied;
  return base;
}

/* ------------------------------ template ------------------------------ */
export async function buildTemplate(type: ImportType): Promise<ArrayBuffer> {
  const def = IMPORT_DEFS[type];
  const wb = new ExcelJS.Workbook();
  wb.creator = "OPSUYON";

  const ws = wb.addWorksheet(def.title.slice(0, 28));
  ws.addRow(def.columns.map((c) => c.label));
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  def.columns.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(14, c.label.length + 6); });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const help = wb.addWorksheet("Açıklama");
  help.addRow([`${def.title} içe aktarma şablonu`]).font = { bold: true, size: 14 };
  help.addRow([def.description]);
  help.addRow([]);
  const hr = help.addRow(["Sütun", "Zorunlu", "Örnek", "Kabul edilen diğer başlıklar / not"]);
  hr.font = { bold: true };
  def.columns.forEach((c) =>
    help.addRow([c.label, c.required ? "Evet" : "Hayır", c.example, [c.note, c.aliases.length ? `Alternatif: ${c.aliases.join(", ")}` : ""].filter(Boolean).join(" · ")]),
  );
  help.addRow([]);
  help.addRow(["İlk sayfadaki başlık satırının altına verilerinizi girin. Kendi dosyanız farklı başlıklar kullanıyorsa yine de yükleyebilirsiniz; tanınan sütunlar önizlemede gösterilir."]);
  [24, 10, 22, 80].forEach((w, i) => { help.getColumn(i + 1).width = w; });

  const out = await wb.xlsx.writeBuffer();
  return out as ArrayBuffer;
}
