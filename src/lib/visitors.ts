import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canAnywhere, hasPermission, type CurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { isoDayInTurkey } from "@/lib/format";
import { LOG_COLUMNS, type Approval, type VisitorKind, type VisitorLog } from "@/lib/visitor-shared";

/** Ziyaretçi defterini tutan personel: bu hizmet alanlarındaki projelerde aktif görevli olanlar. */
export const GUARD_LINES = ["guvenlik", "danisma_tesis"];

export type DeskProject = { id: string; name: string };

const moduleOn = cache(async (): Promise<boolean> => {
  const { data } = await createAdminClient().from("app_modules").select("enabled, implemented").eq("code", "ziyaretci").maybeSingle();
  return Boolean(data?.enabled && data?.implemented);
});

/** Personel hesabı: aktif görevli olduğu Güvenlik / Danışma projeleri (modül açıksa). */
export const guardProjects = cache(async (personnelId: string | null | undefined): Promise<DeskProject[]> => {
  if (!personnelId || !(await moduleOn())) return [];
  const { data } = await createAdminClient()
    .from("personnel_assignments")
    .select("project_id, projects!inner(id, name, service_line, status)")
    .eq("personnel_id", personnelId)
    .is("end_date", null);
  const rows = (data ?? []) as unknown as { projects: { id: string; name: string; service_line: string; status: string } }[];
  const seen = new Map<string, DeskProject>();
  for (const r of rows) {
    const p = r.projects;
    if (p && GUARD_LINES.includes(p.service_line) && p.status !== "closed") seen.set(p.id, { id: p.id, name: p.name });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
});

/** Panel: kayıt girebileceği projeler (merkezde visitors.record; müşteride projede visitors.record + modül açık). */
export const recordableProjects = cache(async (user: CurrentUser): Promise<DeskProject[]> => {
  if (user.kind === "personnel") return guardProjects(user.personnel_id);
  const projects = (await getAccessibleProjects()).filter((p) => p.status !== "closed");
  if (user.kind === "staff") return hasPermission(user, "visitors.record") ? projects.map((p) => ({ id: p.id, name: p.name })) : [];
  if (!canAnywhere(user, "visitors.record") || !(await moduleOn())) return [];
  const supabase = await createClient();
  const checks = await Promise.all(
    projects.map(async (p) => {
      const { data } = await supabase.rpc("my_project_permissions", { p_project_id: p.id });
      return ((data as string[] | null) ?? []).includes("visitors.record") ? { id: p.id, name: p.name } : null;
    }),
  );
  return checks.filter((p): p is DeskProject => p !== null);
});

export async function canRecordOn(user: CurrentUser | null, projectId: string): Promise<boolean> {
  if (!user || !isUuid(projectId)) return false;
  return (await recordableProjects(user)).some((p) => p.id === projectId);
}

/** Kaydı yazanın adı: personel (güvenlik görevlisi) ya da panel kullanıcısı. */
async function withRecorders(rows: (Omit<VisitorLog, "recorder" | "by_personnel"> & { personnel_id: string | null; created_by: string | null })[]): Promise<VisitorLog[]> {
  const admin = createAdminClient();
  const pIds = [...new Set(rows.map((r) => r.personnel_id).filter((x): x is string => Boolean(x)))];
  const uIds = [...new Set(rows.filter((r) => !r.personnel_id).map((r) => r.created_by).filter((x): x is string => Boolean(x)))];
  const [{ data: ps }, { data: us }] = await Promise.all([
    pIds.length ? admin.from("personnel").select("id, full_name").in("id", pIds) : Promise.resolve({ data: [] }),
    uIds.length ? admin.from("profiles").select("id, full_name").in("id", uIds) : Promise.resolve({ data: [] }),
  ]);
  const pn = new Map(((ps ?? []) as { id: string; full_name: string }[]).map((x) => [x.id, x.full_name]));
  const un = new Map(((us ?? []) as { id: string; full_name: string }[]).map((x) => [x.id, x.full_name]));
  return rows.map(({ personnel_id, created_by, ...r }) => ({
    ...r,
    package_count: Number(r.package_count),
    recorder: (personnel_id && pn.get(personnel_id)) || (created_by && un.get(created_by)) || null,
    by_personnel: personnel_id,
  }));
}

/** Türkiye saatiyle bir günün başlangıcı (ISO). */
const dayStart = (day: string) => `${day}T00:00:00+03:00`;
const dayEnd = (day: string) => `${day}T23:59:59.999+03:00`;

export type Desk = {
  inside: VisitorLog[];
  pending: VisitorLog[];
  cargo: VisitorLog[];
  today: VisitorLog[];
  destinations: string[];
};

/**
 * Defter ekranının verisi (çağıran yetkiyi denetlemiş olmalı; servis istemcisiyle okunur):
 * içerideki ziyaretçiler, sakin onayı bekleyenler, kulübede bekleyen kargolar, bugünün kayıtları ve
 * "nereye" kutusu için son kullanılan daire / firma adları.
 */
export async function loadDesk(projectId: string): Promise<Desk> {
  const admin = createAdminClient();
  const today = isoDayInTurkey();
  const base = () => admin.from("visitor_logs").select(LOG_COLUMNS).eq("project_id", projectId);
  const [inside, pending, cargo, todays, dest] = await Promise.all([
    base().eq("kind", "ziyaretci").eq("approval", "onaylandi").is("exited_at", null).gte("entered_at", dayStart(isoDayInTurkey(-2))).order("entered_at", { ascending: false }).limit(200),
    base().eq("kind", "ziyaretci").eq("approval", "bekliyor").gte("entered_at", dayStart(isoDayInTurkey(-1))).order("entered_at", { ascending: false }).limit(100),
    base().eq("kind", "kargo").is("delivered_at", null).gte("entered_at", dayStart(isoDayInTurkey(-30))).order("entered_at", { ascending: false }).limit(200),
    base().gte("entered_at", dayStart(today)).order("entered_at", { ascending: false }).limit(300),
    admin.from("visitor_logs").select("destination").eq("project_id", projectId).order("entered_at", { ascending: false }).limit(400),
  ]);
  type Raw = Omit<VisitorLog, "recorder" | "by_personnel"> & { personnel_id: string | null; created_by: string | null };
  const all = await withRecorders([...(inside.data ?? []), ...(pending.data ?? []), ...(cargo.data ?? []), ...(todays.data ?? [])] as unknown as Raw[]);
  const byId = new Map(all.map((r) => [r.id, r]));
  const pick = (res: { data: unknown }) => ((res.data ?? []) as { id: string }[]).map((r) => byId.get(r.id)!).filter(Boolean);
  const destinations = [...new Set(((dest.data ?? []) as { destination: string }[]).map((d) => d.destination))].slice(0, 150);
  return { inside: pick(inside), pending: pick(pending), cargo: pick(cargo), today: pick(todays), destinations };
}

/* ------------------------------------------------------------------ */
/* Panel: kayıtlar ve günlük rapor                                      */
/* ------------------------------------------------------------------ */
export type LogFilters = {
  projectId?: string;
  from: string;
  to: string;
  kind?: VisitorKind;
  /** iceride | bekliyor | reddedildi | cikti | kargo_bekliyor | teslim */
  status?: string;
  q?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const STATUS_OPTIONS = [
  { value: "iceride", label: "İçeride" },
  { value: "cikti", label: "Çıkış yaptı" },
  { value: "bekliyor", label: "Onay bekliyor" },
  { value: "reddedildi", label: "Reddedildi" },
  { value: "kargo_bekliyor", label: "Kargo kulübede" },
  { value: "teslim", label: "Kargo teslim edildi" },
];

/** URL'den süzgeç: tarih verilmezse bugün (Türkiye). */
export function logFiltersFrom(sp: Record<string, string | string[] | undefined>): LogFilters {
  const today = isoDayInTurkey();
  let from = str1(sp.bas) && ISO.test(str1(sp.bas)!) ? str1(sp.bas)! : today;
  let to = str1(sp.bit) && ISO.test(str1(sp.bit)!) ? str1(sp.bit)! : from;
  if (from > to) [from, to] = [to, from];
  const kind = str1(sp.tur);
  const status = str1(sp.durum);
  return {
    projectId: isUuid(str1(sp.proje)) ? str1(sp.proje) : undefined,
    from, to,
    kind: kind === "ziyaretci" || kind === "kargo" ? kind : undefined,
    status: STATUS_OPTIONS.some((o) => o.value === status) ? status : undefined,
    q: str1(sp.ara)?.replace(/[%_*,()]/g, "").trim().slice(0, 60) || undefined,
  };
}

export const filterQuery = (f: LogFilters) => {
  const q = new URLSearchParams();
  if (f.projectId) q.set("proje", f.projectId);
  q.set("bas", f.from);
  q.set("bit", f.to);
  if (f.kind) q.set("tur", f.kind);
  if (f.status) q.set("durum", f.status);
  if (f.q) q.set("ara", f.q);
  return `?${q.toString()}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<Q extends { eq: any; gte: any; lte: any; is: any; not: any; or: any }>(q: Q, f: LogFilters, opts: { status?: boolean } = {}): Q {
  let r = q.gte("entered_at", dayStart(f.from)).lte("entered_at", dayEnd(f.to));
  if (f.projectId) r = r.eq("project_id", f.projectId);
  if (f.kind) r = r.eq("kind", f.kind);
  if (f.q) r = r.or(`full_name.ilike.%${f.q}%,destination.ilike.%${f.q}%,plate.ilike.%${f.q.replace(/\s/g, "")}%,phone.ilike.%${f.q}%,courier.ilike.%${f.q}%`);
  if (opts.status !== false && f.status) {
    if (f.status === "iceride") r = r.eq("kind", "ziyaretci").eq("approval", "onaylandi").is("exited_at", null);
    if (f.status === "cikti") r = r.eq("kind", "ziyaretci").not("exited_at", "is", null);
    if (f.status === "bekliyor") r = r.eq("kind", "ziyaretci").eq("approval", "bekliyor");
    if (f.status === "reddedildi") r = r.eq("kind", "ziyaretci").eq("approval", "reddedildi");
    if (f.status === "kargo_bekliyor") r = r.eq("kind", "kargo").is("delivered_at", null);
    if (f.status === "teslim") r = r.eq("kind", "kargo").not("delivered_at", "is", null);
  }
  return r;
}

type Raw = Omit<VisitorLog, "recorder" | "by_personnel"> & { personnel_id: string | null; created_by: string | null };

/** Liste (kullanıcı oturumuyla; RLS visitors.read). */
export async function loadLogs(f: LogFilters, range: { from: number; to: number }, db?: SupabaseClient): Promise<{ rows: VisitorLog[]; total: number }> {
  const supabase = db ?? (await createClient());
  const { data, count } = await applyFilters(supabase.from("visitor_logs").select(LOG_COLUMNS, { count: "exact" }), f)
    .order("entered_at", { ascending: false })
    .range(range.from, range.to);
  return { rows: await withRecorders((data ?? []) as unknown as Raw[]), total: count ?? 0 };
}

/** Rapor (PDF): süzgece uyan tüm kayıtlar, eskiden yeniye (en çok 5000). */
export async function loadReport(f: LogFilters): Promise<VisitorLog[]> {
  const supabase = await createClient();
  const { data } = await applyFilters(supabase.from("visitor_logs").select(LOG_COLUMNS), f).order("entered_at").limit(5000);
  return withRecorders((data ?? []) as unknown as Raw[]);
}

export type LogCounts = { visitors: number; inside: number; pending: number; rejected: number; cargo: number; cargoWaiting: number };

/** Sayaçlar: seçili tarih aralığı + proje + arama (durum süzgecinden bağımsız). */
export async function loadCounts(f: LogFilters): Promise<LogCounts> {
  const supabase = await createClient();
  const count = async (extra: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count: c } = await extra(base());
    return c ?? 0;
  };
  const base = () => applyFilters(supabase.from("visitor_logs").select("id", { count: "exact", head: true }), { ...f, kind: undefined }, { status: false });
  const [visitors, inside, pending, rejected, cargo, cargoWaiting] = await Promise.all([
    count((q) => q.eq("kind", "ziyaretci")),
    count((q) => q.eq("kind", "ziyaretci").eq("approval", "onaylandi").is("exited_at", null)),
    count((q) => q.eq("kind", "ziyaretci").eq("approval", "bekliyor")),
    count((q) => q.eq("kind", "ziyaretci").eq("approval", "reddedildi")),
    count((q) => q.eq("kind", "kargo")),
    count((q) => q.eq("kind", "kargo").is("delivered_at", null)),
  ]);
  return { visitors, inside, pending, rejected, cargo, cargoWaiting };
}

export type { Approval };
