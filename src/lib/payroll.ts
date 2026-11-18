import "server-only";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAnywhere, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { LINE_COLUMNS, numify, type PayrollLineRow, type PayrollLineView, type PayrollRunView } from "@/lib/payroll-shared";

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

/**
 * Bir dönemi (proje + ay) ve satırlarını okur. Dönemin GÖRÜNÜRLÜĞÜ `db` ile (kullanıcı oturumu → RLS) belirlenir;
 * görünüyorsa adlar (firma, proje, personel, onaylayan) servis anahtarıyla tamamlanır.
 */
export async function loadPayrollRun(db: SupabaseClient, runId: string): Promise<PayrollRunView | null> {
  const { data: run } = await db
    .from("payroll_runs")
    .select("id, project_id, period_year, period_month, status, approved_at, approved_by")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return null;
  const { data: lineRows } = await db.from("payroll_lines").select(LINE_COLUMNS).eq("run_id", runId).limit(2000);
  const lines = ((lineRows ?? []) as unknown as PayrollLineRow[]).map(numify);
  return decorate(run as RunRow, lines);
}

type RunRow = { id: string; project_id: string; period_year: number; period_month: number; status: "draft" | "approved"; approved_at: string | null; approved_by: string | null };

async function decorate(run: RunRow, lines: PayrollLineRow[]): Promise<PayrollRunView> {
  const admin = createAdminClient();
  const ids = [...new Set(lines.map((l) => l.personnel_id))];
  const [{ data: project }, { data: people }, { data: approver }] = await Promise.all([
    admin.from("projects").select("name, organizations(name)").eq("id", run.project_id).maybeSingle(),
    ids.length ? admin.from("personnel").select("id, full_name, title").in("id", ids) : Promise.resolve({ data: [] }),
    run.approved_by ? admin.from("profiles").select("full_name").eq("id", run.approved_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const byId = new Map(((people ?? []) as { id: string; full_name: string; title: string | null }[]).map((p) => [p.id, p]));
  const views: PayrollLineView[] = lines
    .map((l) => ({ ...l, full_name: byId.get(l.personnel_id)?.full_name ?? "—", title: byId.get(l.personnel_id)?.title ?? null }))
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
    lines: views,
  };
}


