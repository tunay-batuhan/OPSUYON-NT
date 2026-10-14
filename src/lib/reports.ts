import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MONTHS } from "@/lib/format";

export type ReportType = "timesheet" | "personnel" | "finance" | "leave" | "contracts";
export type ColType = "text" | "number" | "money" | "date";
export type Cell = string | number | null;
export type Report = { title: string; subtitle: string; columns: { label: string; type: ColType }[]; rows: Cell[][] };
export type ReportParams = { projectId?: string; year: number; month: number; days: number };

export const REPORT_DEFS: Record<ReportType, { title: string; description: string; permission: string }> = {
  timesheet: { title: "Aylık puantaj özeti", description: "Personel bazında çalışılan gün, izin, devamsızlık ve fazla mesai.", permission: "timesheets.read" },
  personnel: { title: "Personel listesi", description: "Projelerdeki görevli personel, görev ve vardiya bilgisi.", permission: "personnel.read" },
  finance: { title: "Cari hesap özeti", description: "Proje bazında güncel cari bakiye (ekstrenin son satırı).", permission: "ledger.read" },
  leave: { title: "Yıllık izin bakiyeleri", description: "Hak edilen, devreden, kullanılan ve kalan izin günleri.", permission: "leaves.read" },
  contracts: { title: "Yaklaşan sözleşmeler", description: "Bitiş tarihi yaklaşan aktif projeler.", permission: "projects.read" },
};

const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

export async function buildReport(type: ReportType, p: ReportParams, supabase: SupabaseClient): Promise<Report> {
  const project = uuid(p.projectId);

  if (type === "timesheet") {
    let q = supabase
      .from("timesheets")
      .select("worked_days, leave_days, absence_days, overtime_hours, projects(name), personnel(full_name, employee_no)")
      .eq("period_year", p.year).eq("period_month", p.month).limit(5000);
    if (project) q = q.eq("project_id", project);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown as { worked_days: number; leave_days: number; absence_days: number; overtime_hours: number; projects: { name: string } | null; personnel: { full_name: string; employee_no: string | null } | null }[])
      .sort((a, b) => (a.projects?.name ?? "").localeCompare(b.projects?.name ?? "", "tr") || (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"))
      .map((r): Cell[] => [r.projects?.name ?? "", r.personnel?.employee_no ?? "", r.personnel?.full_name ?? "", Number(r.worked_days), Number(r.leave_days), Number(r.absence_days), Number(r.overtime_hours)]);
    return {
      title: REPORT_DEFS.timesheet.title, subtitle: `${MONTHS[p.month - 1]} ${p.year}`,
      columns: [{ label: "Proje", type: "text" }, { label: "Sicil No", type: "text" }, { label: "Personel", type: "text" }, { label: "Çalışılan Gün", type: "number" }, { label: "İzin", type: "number" }, { label: "Devamsızlık", type: "number" }, { label: "Fazla Mesai (sa)", type: "number" }],
      rows,
    };
  }

  if (type === "personnel") {
    let q = supabase
      .from("personnel_assignments")
      .select("position, shift, start_date, end_date, projects(name), personnel(full_name, employee_no, title)")
      .order("start_date", { ascending: false }).limit(5000);
    if (project) q = q.eq("project_id", project);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown as { position: string | null; shift: string | null; start_date: string; end_date: string | null; projects: { name: string } | null; personnel: { full_name: string; employee_no: string | null; title: string | null } | null }[])
      .sort((a, b) => (a.projects?.name ?? "").localeCompare(b.projects?.name ?? "", "tr") || (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"))
      .map((r): Cell[] => [r.projects?.name ?? "", r.personnel?.employee_no ?? "", r.personnel?.full_name ?? "", r.position ?? r.personnel?.title ?? "", r.shift ?? "", r.start_date, r.end_date, r.end_date ? "Ayrıldı" : "Aktif"]);
    return {
      title: REPORT_DEFS.personnel.title, subtitle: "Tüm görevlendirmeler",
      columns: [{ label: "Proje", type: "text" }, { label: "Sicil No", type: "text" }, { label: "Ad Soyad", type: "text" }, { label: "Görev", type: "text" }, { label: "Vardiya", type: "text" }, { label: "Başlangıç", type: "date" }, { label: "Bitiş", type: "date" }, { label: "Durum", type: "text" }],
      rows,
    };
  }

  if (type === "finance") {
    let q = supabase
      .from("ledger_statements")
      .select("project_id, closing_balance, as_of_date, row_count, projects(name, organizations(name))")
      .eq("is_current", true)
      .limit(2000);
    if (project) q = q.eq("project_id", project);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown as { closing_balance: number; as_of_date: string | null; row_count: number; projects: { name: string; organizations: { name: string } | null } | null }[])
      .sort((a, b) => (a.projects?.name ?? "").localeCompare(b.projects?.name ?? "", "tr"))
      .map((r): Cell[] => [r.projects?.name ?? "", r.projects?.organizations?.name ?? "", r.as_of_date, r.row_count, Number(r.closing_balance)]);
    return {
      title: REPORT_DEFS.finance.title, subtitle: "Yüklenen ekstrelerin son satır bakiyeleri",
      columns: [{ label: "Proje", type: "text" }, { label: "Firma", type: "text" }, { label: "Ekstre Tarihi", type: "date" }, { label: "Satır", type: "number" }, { label: "Güncel Bakiye", type: "money" }],
      rows,
    };
  }

  if (type === "leave") {
    const { data, error } = await supabase
      .from("leave_balances")
      .select("entitled_days, carried_days, used_days, remaining_days, personnel(full_name, employee_no, personnel_assignments(project_id, end_date, projects(name)))")
      .eq("year", p.year).limit(5000);
    if (error) throw new Error(error.message);
    type R = { entitled_days: number; carried_days: number; used_days: number; remaining_days: number; personnel: { full_name: string; employee_no: string | null; personnel_assignments: { project_id: string; end_date: string | null; projects: { name: string } | null }[] } | null };
    let list = (data ?? []) as unknown as R[];
    if (project) list = list.filter((r) => r.personnel?.personnel_assignments.some((a) => a.project_id === project));
    const rows = list
      .sort((a, b) => (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"))
      .map((r): Cell[] => [
        r.personnel?.employee_no ?? "", r.personnel?.full_name ?? "",
        [...new Set((r.personnel?.personnel_assignments ?? []).filter((a) => !a.end_date).map((a) => a.projects?.name).filter(Boolean))].join(", "),
        Number(r.entitled_days), Number(r.carried_days), Number(r.used_days), Number(r.remaining_days),
      ]);
    return {
      title: REPORT_DEFS.leave.title, subtitle: `${p.year} yılı`,
      columns: [{ label: "Sicil No", type: "text" }, { label: "Personel", type: "text" }, { label: "Proje", type: "text" }, { label: "Hak Edilen", type: "number" }, { label: "Devreden", type: "number" }, { label: "Kullanılan", type: "number" }, { label: "Kalan", type: "number" }],
      rows,
    };
  }

  // contracts
  const today = new Date();
  const limit = new Date(today.getTime() + p.days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("projects")
    .select("name, service_line, end_date, organizations(name)")
    .eq("status", "active").gte("end_date", today.toISOString().slice(0, 10)).lte("end_date", limit)
    .order("end_date").limit(2000);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as { name: string; service_line: string; end_date: string; organizations: { name: string } | null }[]).map((r): Cell[] => [
    r.name, r.organizations?.name ?? "", r.service_line, r.end_date, Math.ceil((new Date(r.end_date).getTime() - today.getTime()) / 86400000),
  ]);
  return {
    title: REPORT_DEFS.contracts.title, subtitle: `Önümüzdeki ${p.days} gün`,
    columns: [{ label: "Proje", type: "text" }, { label: "Firma", type: "text" }, { label: "Hizmet Alanı", type: "text" }, { label: "Bitiş", type: "date" }, { label: "Kalan Gün", type: "number" }],
    rows,
  };
}
