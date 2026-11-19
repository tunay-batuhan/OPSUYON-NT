import "server-only";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAnywhere, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { DEFAULT_TEMPLATE, computeRow, normalizeTemplate, round2, sumRows, validateTemplate, type Cells, type PayCol, type RateVars } from "@/lib/payroll-engine";
import type { PayrollLineView, PayrollRunView } from "@/lib/payroll-shared";

/**
 * Bordro sekmelerinin kapısı: yetkilerden en az biri (herhangi bir projede) gerekir; müşteride "Bordrolar" modülü
 * de açık olmalı. Personel hesabı bordro görmez; Görevlerim'e döner.
 */
export async function requirePayrollAccess(perms: string[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.kind === "personnel") redirect("/gorevlerim"); // personel bordro görmez
  if (user.kind === "customer" && !(await getEnabledModules()).has("personel_bordro")) notFound();
  if (!perms.some((p) => canAnywhere(user, p))) notFound();
  return user;
}

/** Ayın ilk ve son günü (YYYY-AA-GG). */
export function monthBounds(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Türkiye saatine göre bu ay. */
export function currentPeriod(): { year: number; month: number } {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).format(new Date()).split("-");
  return { year: Number(y), month: Number(m) };
}

/**
 * Projeler arasında, kullanıcının bu yetkiye sahip olduklarının kimlikleri. Merkez: yetki globalse hepsi (null = hepsi).
 * Müşteri: projeye göre (my_project_permissions).
 */
export async function projectsWith(user: CurrentUser, perm: string, projectIds: string[]): Promise<Set<string> | null> {
  if (user.kind === "staff") return canAnywhere(user, perm) ? null : new Set();
  const supabase = await createClient();
  const res = await Promise.all(projectIds.map((id) => supabase.rpc("my_project_permissions", { p_project_id: id })));
  return new Set(projectIds.filter((_, i) => ((res[i].data as string[] | null) ?? []).includes(perm)));
}

/* ------------------------------------------------------------------ */
/* Şablon                                                              */
/* ------------------------------------------------------------------ */
export type TemplateSource = "proje" | "varsayilan" | "hazir";

const usable = (raw: unknown): PayCol[] | null => {
  const cols = normalizeTemplate(raw);
  return cols && validateTemplate(cols).length === 0 ? cols : null;
};

/**
 * Projenin bordro şablonu: projeye özel şablon → merkezin kaydettiği varsayılan → uygulamadaki hazır şablon
 * (müşterinin Excel düzeni). Çağıran yetkiyi denetlemiş olmalı (servis istemcisiyle okunur).
 */
export async function loadTemplate(projectId: string | null): Promise<{ columns: PayCol[]; source: TemplateSource }> {
  const admin = createAdminClient();
  if (projectId) {
    const { data } = await admin.from("payroll_templates").select("columns").eq("project_id", projectId).maybeSingle();
    const cols = usable(data?.columns);
    if (cols) return { columns: cols, source: "proje" };
  }
  const { data: def } = await admin.from("payroll_templates").select("columns").is("project_id", null).maybeSingle();
  const cols = usable(def?.columns);
  return cols ? { columns: cols, source: "varsayilan" } : { columns: DEFAULT_TEMPLATE, source: "hazir" };
}

/** Personellerin formül değişkenleri: ücret tanımı (tanim_…) ve o ay projede girilen avansların toplamı (avans_kayit). */
export async function rateVarsFor(projectId: string, year: number, month: number, personnelIds: string[]): Promise<Map<string, { vars: RateVars; has: boolean }>> {
  const out = new Map<string, { vars: RateVars; has: boolean }>();
  if (!personnelIds.length) return out;
  const admin = createAdminClient();
  const [{ data: rates }, { data: adv }] = await Promise.all([
    admin.from("pay_rates").select("personnel_id, net_salary, transport_monthly, support_monthly, meal_monthly, overtime_monthly, extra_monthly, bes_monthly").in("personnel_id", personnelIds),
    admin.from("pay_advances").select("personnel_id, amount").eq("project_id", projectId).eq("period_year", year).eq("period_month", month).in("personnel_id", personnelIds),
  ]);
  const advOf = new Map<string, number>();
  for (const a of (adv ?? []) as { personnel_id: string; amount: number }[]) advOf.set(a.personnel_id, (advOf.get(a.personnel_id) ?? 0) + Number(a.amount));
  const rateOf = new Map(((rates ?? []) as Record<string, unknown>[]).map((r) => [r.personnel_id as string, r]));
  for (const id of personnelIds) {
    const r = rateOf.get(id);
    const n = (k: string) => Number(r?.[k] ?? 0);
    out.set(id, {
      has: Boolean(r),
      vars: {
        tanim_net_maas: n("net_salary"), tanim_yol: n("transport_monthly"), tanim_destek: n("support_monthly"), tanim_ticket: n("meal_monthly"),
        tanim_fazla_mesai: n("overtime_monthly"), tanim_ek: n("extra_monthly"), tanim_bes: n("bes_monthly"),
        avans_kayit: Math.round((advOf.get(id) ?? 0) * 100) / 100,
      },
    });
  }
  return out;
}

type RunRow = {
  id: string; project_id: string; period_year: number; period_month: number; status: "draft" | "approved";
  approved_at: string | null; approved_by: string | null; template: unknown;
};
type LineRow = { id: string; personnel_id: string; cells: Cells | null; vars: RateVars | null } & Partial<Record<LegacyKey, number | string | null>>;

/** Şablonlu bordrodan ÖNCE (19 Kasım 2026 öncesi) açılmış dönemlerin satırlarındaki dondurulmuş tutar sütunları. */
const LEGACY_KEYS = [
  "net_salary", "worked_days", "normal_pay", "transport_pay", "meal_pay", "extra_pay", "overtime_days", "overtime_pay",
  "advance_total", "bes_deduction", "ihbar_deduction", "other_deduction",
] as const;
type LegacyKey = (typeof LEGACY_KEYS)[number];

/**
 * Eski düzende açılmış dönemin satırı: hücreler boş, tutarlar eski sütunlarda. O tutarlar hücre olarak okunur,
 * böylece eski bordro (özellikle onaylı olan) açıldığında bugünkü ücret tanımıyla yeniden hesaplanmaz, aynı kalır.
 */
function legacyCells(l: LineRow): Cells {
  const n = (k: LegacyKey) => Number(l[k] ?? 0) || 0;
  return {
    net_maas: n("net_salary"), gun: n("worked_days"), normal: n("normal_pay"), yol: n("transport_pay"), destek: 0,
    ticket: n("meal_pay"), emekli: n("extra_pay"), bayram: 0, fmesai_gun: n("overtime_days"), fmesai: n("overtime_pay"),
    avans: n("advance_total"), ceza: 0, bes: n("bes_deduction"), diger: round2(n("ihbar_deduction") + n("other_deduction")),
  };
}

/**
 * Bir dönemi (proje + ay) ve satırlarını okur. Dönemin GÖRÜNÜRLÜĞÜ `db` ile (kullanıcı oturumu → RLS) belirlenir.
 * Taslakta tutarlar güncel ücret tanımı ve avanslarla hesaplanır; onaylı dönemde onay anında dondurulan
 * değişkenlerle (satırdaki `vars`) hesaplanır, sonradan değişen ücret tanımı onaylı bordroyu değiştirmez.
 */
export async function loadPayrollRun(db: SupabaseClient, runId: string): Promise<PayrollRunView | null> {
  const { data: runData } = await db
    .from("payroll_runs")
    .select("id, project_id, period_year, period_month, status, approved_at, approved_by, template")
    .eq("id", runId)
    .maybeSingle();
  const run = runData as RunRow | null;
  if (!run) return null;
  const legacy = !usable(run.template);
  const { data: lineRows } = await db
    .from("payroll_lines")
    .select(`id, personnel_id, cells, vars${legacy ? ", " + LEGACY_KEYS.join(", ") : ""}`)
    .eq("run_id", runId)
    .limit(2000);
  const rows = (lineRows ?? []) as unknown as LineRow[];
  const ids = [...new Set(rows.map((l) => l.personnel_id))];
  const columns = usable(run.template) ?? (await loadTemplate(run.project_id)).columns;

  const admin = createAdminClient();
  const [{ data: project }, { data: people }, { data: approver }, live] = await Promise.all([
    admin.from("projects").select("name, organizations(name)").eq("id", run.project_id).maybeSingle(),
    ids.length ? admin.from("personnel").select("id, full_name, title").in("id", ids) : Promise.resolve({ data: [] }),
    run.approved_by ? admin.from("profiles").select("full_name").eq("id", run.approved_by).maybeSingle() : Promise.resolve({ data: null }),
    rateVarsFor(run.project_id, run.period_year, run.period_month, ids),
  ]);
  const byId = new Map(((people ?? []) as { id: string; full_name: string; title: string | null }[]).map((p) => [p.id, p]));
  const lines: PayrollLineView[] = rows
    .map((l) => {
      const lv = live.get(l.personnel_id);
      const vars = run.status === "approved" && l.vars ? l.vars : (lv?.vars ?? {});
      const own = l.cells ?? {};
      const cells = legacy && Object.keys(own).length === 0 ? legacyCells(l) : own;
      const r = computeRow(columns, cells, vars);
      return {
        id: l.id, personnel_id: l.personnel_id,
        full_name: byId.get(l.personnel_id)?.full_name ?? "—", title: byId.get(l.personnel_id)?.title ?? null,
        has_rates: lv?.has ?? false, cells, values: r.values, texts: r.texts, overridden: r.overridden, vars,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));
  const p = project as unknown as { name: string; organizations: { name: string } | null } | null;
  return {
    id: run.id,
    project_id: run.project_id,
    org: p?.organizations?.name ?? "",
    project: p?.name ?? "",
    year: run.period_year,
    month: run.period_month,
    status: run.status,
    approvedAt: run.approved_at,
    approvedBy: (approver as { full_name: string } | null)?.full_name ?? null,
    columns,
    lines,
    totals: sumRows(columns, lines),
  };
}
