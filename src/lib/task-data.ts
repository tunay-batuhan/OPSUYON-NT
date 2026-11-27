import "server-only";
import { cache } from "react";
import { canAnywhere, hasPermission, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleProjects, isUuid, str1, type ProjectLite } from "@/lib/lookups";

/** İş Planlama listesi ve PDF raporu için ortak süzgeç (adres parametreleri). */
export type TaskFilters = {
  projectId?: string;
  name?: string;
  job?: string;
  from?: string;
  to?: string;
  /** bekleyen | planlanan | tarih | sorun | bitirdi | tamam | iptal | acik */
  stage?: string;
  /**
   * Yalnızca merkez kullanıcısında: saha = projedeki personele atanan görevler, merkez = merkez kullanıcılarına
   * atananlar, bana = oturumdaki kullanıcıya atananlar. Müşteride boştur (RLS zaten yalnızca saha görevini verir).
   */
  scope?: TaskScope;
  /** scope "bana" iken oturumdaki kullanıcı */
  me?: string;
};

export type TaskScope = "saha" | "merkez" | "bana";
export const TASK_SCOPE_LABELS: Record<TaskScope, string> = { saha: "Saha görevleri", merkez: "Merkez görevleri", bana: "Bana atananlar" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v?: string) => v?.replace(/[%_*,()]/g, "").trim() || undefined;

export function taskFiltersFrom(sp: Record<string, string | string[] | undefined>, user?: Pick<CurrentUser, "id" | "kind" | "permissions" | "roleCode">): TaskFilters {
  const from = str1(sp.bas);
  const to = str1(sp.bit);
  const stage = str1(sp.durum);
  const tur = str1(sp.tur);
  // merkez: sekme adresten; verilmediyse saha (saha görevlerini göremeyen kullanıcıda "bana atananlar")
  const scope: TaskScope | undefined =
    user?.kind !== "staff" ? undefined : tur === "merkez" || tur === "bana" || tur === "saha" ? tur : hasPermission(user, "tasks.read") ? "saha" : "bana";
  return {
    scope,
    me: scope === "bana" ? user?.id : undefined,
    projectId: isUuid(str1(sp.proje)) ? str1(sp.proje) : undefined,
    name: clean(str1(sp.ad)),
    job: clean(str1(sp.gorev)),
    from: from && ISO.test(from) ? from : undefined,
    to: to && ISO.test(to) ? to : from && ISO.test(from) ? from : undefined,
    stage: stage && ["bekleyen", "planlanan", "tarih", "sorun", "bitirdi", "tamam", "iptal", "acik"].includes(stage) ? stage : undefined,
  };
}

export const filterQuery = (f: TaskFilters) => {
  const q = new URLSearchParams();
  if (f.projectId) q.set("proje", f.projectId);
  if (f.name) q.set("ad", f.name);
  if (f.job) q.set("gorev", f.job);
  if (f.from) q.set("bas", f.from);
  if (f.to) q.set("bit", f.to);
  if (f.stage) q.set("durum", f.stage);
  if (f.scope && f.scope !== "saha") q.set("tur", f.scope);
  const s = q.toString();
  return s ? `?${s}` : "";
};

const nextDay = (iso: string) => new Date(Date.parse(iso + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);

// supabase-js sorgu kurucusunun zincir türü seçilen sütunlara göre değişir; süzgeç yardımcıları türden bağımsızdır
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

const NO_ID = "00000000-0000-0000-0000-000000000000";
const staffScope = (f: TaskFilters) => f.scope === "merkez" || f.scope === "bana";

/**
 * Süzgeçleri (durum hariç) bir work_tasks sorgusuna uygular. Tarih: görev tarihi; tarihsiz görevde atama tarihi.
 * `staffIds`: merkez sekmesinde ad süzgecine uyan merkez kullanıcıları (ad, profilden aranır).
 */
function applyFilters(q: Q, f: TaskFilters, staffIds?: string[]): Q {
  // saha görevinde personel her zaman dolu, merkez görevinde boştur
  if (f.scope === "saha") q = q.not("personnel_id", "is", null);
  else if (f.scope === "merkez") q = q.is("personnel_id", null);
  else if (f.scope === "bana") q = q.eq("assignee_id", f.me ?? NO_ID);
  if (staffScope(f)) {
    if (f.name && f.scope === "merkez") q = q.in("assignee_id", staffIds?.length ? staffIds : [NO_ID]);
  } else {
    if (f.projectId) q = q.eq("project_id", f.projectId);
    if (f.name) q = q.ilike("personnel.full_name", `%${f.name}%`);
    if (f.job) q = q.eq("job", f.job);
  }
  if (f.from && f.to) {
    q = q.or(
      `and(planned_date.gte.${f.from},planned_date.lte.${f.to}),and(planned_date.is.null,created_at.gte.${f.from},created_at.lt.${nextDay(f.to)})`,
    );
  }
  return q;
}

function applyStage(q: Q, stage?: string): Q {
  switch (stage) {
    case "bekleyen":
      return q.eq("status", "pending");
    case "sorun":
      return q.eq("status", "issue");
    case "planlanan":
      return q.eq("status", "accepted").not("planned_date", "is", null).is("finished_by_personnel_at", null);
    case "tarih":
      return q.eq("status", "accepted").is("planned_date", null).is("finished_by_personnel_at", null);
    case "bitirdi":
      return q.eq("status", "accepted").not("finished_by_personnel_at", "is", null);
    case "tamam":
      return q.eq("status", "done");
    case "iptal":
      return q.eq("status", "cancelled");
    case "acik":
      return q.in("status", ["pending", "issue", "accepted"]);
    default:
      return q;
  }
}

export type TaskListRow = {
  id: string;
  project_id: string | null;
  personnel_id: string | null;
  assignee_id?: string | null;
  /** merkez görevinde görevin atandığı kullanıcının adı */
  assignee_name?: string | null;
  title: string;
  job: string | null;
  location: string | null;
  description: string | null;
  planned_date: string | null;
  planned_time: string | null;
  status: string;
  issue_note: string | null;
  finished_by_personnel_at: string | null;
  completed_at: string | null;
  created_at: string;
  personnel: { full_name: string } | null;
  projects: { name: string } | null;
};

// "*": merkez görevi sütunu (assignee_id) veritabanında henüz yoksa da liste çalışır
export const TASK_LIST_COLUMNS = "*, projects(name)";

/**
 * Merkez kullanıcıları (ad + etkin mi). profiles tablosunu yalnızca "users.read" yetkisi olan okuyabildiği için
 * servis anahtarıyla okunur; YALNIZCA merkez kullanıcısına gösterilecek yerde çağrılır (çağıran doğrular).
 */
export const staffDirectory = cache(async (): Promise<{ id: string; full_name: string; is_active: boolean; role: string | null }[]> => {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, is_active, roles:staff_role_id(name)")
    .eq("kind", "staff")
    .order("full_name")
    .limit(1000);
  return ((data ?? []) as unknown as { id: string; full_name: string; is_active: boolean; roles: { name: string } | null }[]).map((p) => ({
    id: p.id, full_name: p.full_name, is_active: p.is_active, role: p.roles?.name ?? null,
  }));
});

/** Görev atanabilecek merkez kullanıcıları: merkezde tasks.assign yetkisi olan atar; etkin tüm merkez kullanıcıları seçilebilir. */
export async function assignableStaff(user: CurrentUser): Promise<{ value: string; label: string }[]> {
  if (user.kind !== "staff" || !hasPermission(user, "tasks.assign")) return [];
  return (await staffDirectory())
    .filter((p) => p.is_active)
    .map((p) => ({ value: p.id, label: p.id === user.id ? `${p.full_name} (ben)` : p.role ? `${p.full_name} · ${p.role}` : p.full_name }));
}

/**
 * Merkez görevlerinde atanan kullanıcının adını ekler. Merkez görevi satırını RLS yalnızca merkez kullanıcısına
 * verdiği için ad da yalnızca merkez kullanıcısına ulaşır.
 */
export async function withAssigneeNames<T extends { assignee_id?: string | null; assignee_name?: string | null }>(rows: T[]): Promise<T[]> {
  if (!rows.some((r) => r.assignee_id)) return rows;
  const names = new Map((await staffDirectory()).map((p) => [p.id, p.full_name]));
  return rows.map((r) => (r.assignee_id ? { ...r, assignee_name: names.get(r.assignee_id) ?? null } : r));
}

const lower = (v: string) => v.toLocaleLowerCase("tr");
/** Merkez sekmesinde ad süzgecine uyan kullanıcılar. */
async function staffIdsByName(f: TaskFilters): Promise<string[] | undefined> {
  if (!(f.name && f.scope === "merkez")) return undefined;
  const needle = lower(f.name);
  return (await staffDirectory()).filter((p) => lower(p.full_name).includes(needle)).map((p) => p.id);
}

/** Liste (sayfalı) ya da PDF için tümü (limit). Sıra: en yeni atanan üstte. */
export async function loadTasks(f: TaskFilters, range: { from: number; to: number }) {
  const supabase = await createClient();
  const person = f.name && !staffScope(f) ? "personnel!inner(full_name)" : "personnel(full_name)";
  let q = supabase.from("work_tasks").select(`${TASK_LIST_COLUMNS}, ${person}`, { count: "exact" });
  q = applyStage(applyFilters(q, f, await staffIdsByName(f)), f.stage);
  const { data, count } = await q.order("created_at", { ascending: false }).range(range.from, range.to);
  return { rows: await withAssigneeNames((data ?? []) as unknown as TaskListRow[]), total: count ?? 0 };
}

export type TaskCounts = { pending: number; planned: number; waitingDate: number; issue: number; finished: number; done: number };

/** Üstteki sayaçlar: durum süzgeci hariç diğer süzgeçler uygulanır. */
export async function loadTaskCounts(f: TaskFilters): Promise<TaskCounts> {
  const supabase = await createClient();
  const person = f.name && !staffScope(f) ? "id, personnel!inner(full_name)" : "id";
  const staffIds = await staffIdsByName(f);
  const count = async (stage: string) => {
    const q = applyStage(applyFilters(supabase.from("work_tasks").select(person, { count: "exact", head: true }), f, staffIds), stage);
    const { count: c } = await q;
    return (c as number | null) ?? 0;
  };
  const [pending, planned, waitingDate, issue, finished, done] = await Promise.all(
    ["bekleyen", "planlanan", "tarih", "sorun", "bitirdi", "tamam"].map(count),
  );
  return { pending, planned, waitingDate, issue, finished, done };
}

/** Görev atanabilecek projeler: merkezde tasks.assign varsa tümü; müşteride projede tasks.assign olanlar. */
export const assignableProjects = cache(async (user: CurrentUser): Promise<ProjectLite[]> => {
  const projects = (await getAccessibleProjects()).filter((p) => p.status !== "closed");
  if (user.kind === "staff") return hasPermission(user, "tasks.assign") ? projects : [];
  if (!canAnywhere(user, "tasks.assign")) return [];
  const supabase = await createClient();
  const checks = await Promise.all(
    projects.map(async (p) => {
      const { data } = await supabase.rpc("my_project_permissions", { p_project_id: p.id });
      return ((data as string[] | null) ?? []).includes("tasks.assign") ? p : null;
    }),
  );
  return checks.filter((p): p is ProjectLite => p !== null);
});

export type AssignablePerson = { value: string; label: string; project_id: string; job: string };

/** Projelerde AKTİF görevli personel (görev yalnızca onlara atanır); "Görevi" alanı pozisyon ya da unvandan dolar. */
export async function assignablePersonnel(projectIds: string[]): Promise<AssignablePerson[]> {
  if (projectIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("personnel_assignments")
    .select("project_id, position, personnel(id, full_name, title, status)")
    .in("project_id", projectIds)
    .is("end_date", null)
    .limit(3000);
  const rows = (data ?? []) as unknown as { project_id: string; position: string | null; personnel: { id: string; full_name: string; title: string | null; status: string } | null }[];
  return rows
    .filter((r) => r.personnel && r.personnel.status !== "terminated")
    .map((r) => ({ value: r.personnel!.id, label: r.personnel!.full_name, project_id: r.project_id, job: r.position ?? r.personnel!.title ?? "" }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

/** "Görevi" süzgecinin seçenekleri: görevlerde geçen görev adları. */
export async function taskJobOptions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("work_tasks").select("job").not("job", "is", null).order("job").limit(2000);
  return [...new Set(((data ?? []) as { job: string }[]).map((r) => r.job))];
}

/** Oturumdaki merkez kullanıcısına atanmış, yanıtını (kabul / sorun) bekleyen görev sayısı. Sütun yoksa 0. */
export async function myPendingTaskCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("work_tasks").select("id", { count: "exact", head: true }).eq("assignee_id", userId).eq("status", "pending");
  return error ? 0 : (count ?? 0);
}
