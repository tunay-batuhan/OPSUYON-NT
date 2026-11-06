import Link from "next/link";
import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { LeaveDocCell } from "@/components/forms/leave-forms";
import { redirect } from "next/navigation";
import { hasPermission, requireUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_TYPE_LABELS, formatDate, formatNumber } from "@/lib/format";
import { LEAVE_TYPE_INFO, leaveDeducts } from "@/lib/leave-law";
import { deleteLeaveRecord } from "@/app/actions/leaves";

export const metadata: Metadata = { title: "İzin Yönetimi" };

type RecordRow = {
  id: string; personnel_id: string; project_id: string | null; leave_type: string; start_date: string; end_date: string;
  return_date: string | null; days: number; note: string | null; document_id: string | null;
  personnel: { full_name: string } | null; projects: { name: string } | null;
};
type BalanceRow = {
  id: string; personnel_id: string; entitled_days: number; carried_days: number; used_days: number; remaining_days: number;
  personnel: { id: string; full_name: string; personnel_assignments: { project_id: string; end_date: string | null; projects: { name: string } | null }[] } | null;
};

const DEDUCTING = LEAVE_TYPE_INFO.filter((t) => t.deducts).map((t) => t.code);

/** Kayıtlı izinler (tek satır, kalan süre, evrak) ve yıllık izin bakiyeleri. Yeni izin: "İzin evrakı ekle" sekmesi. */
export default async function LeavesAllPage({ searchParams }: PageProps<"/izinler">) {
  const user = await requireUser();
  if (user.kind === "customer" && !(await getEnabledModules()).has("izin_yonetimi")) redirect("/personel/izinler");
  const sp = await searchParams;
  const year = Number(str1(sp.yil) ?? new Date().getFullYear());
  const projectId = str1(sp.proje);
  const name = str1(sp.ad)?.replace(/[%_*,()]/g, "").trim() || undefined;
  const type = LEAVE_TYPE_INFO.some((t) => t.code === str1(sp.tur)) ? str1(sp.tur) : undefined;
  const evrak = str1(sp.evrak);
  const projects = await getAccessibleProjects();
  const manage = user.kind === "staff" && hasPermission(user, "leaves.manage");
  const { from, to } = pagingFrom(sp);

  const supabase = await createClient();
  // Ad filtresi yalnızca personel adına göre süzer; !inner olmadan ilişki boş kalır ama satır gelirdi.
  let rq = supabase
    .from("leave_records")
    .select(
      `id, personnel_id, project_id, leave_type, start_date, end_date, return_date, days, note, document_id, ${name ? "personnel!inner(full_name)" : "personnel(full_name)"}, projects(name)`,
      { count: "exact" },
    )
    .gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (isUuid(projectId)) rq = rq.eq("project_id", projectId);
  if (name) rq = rq.ilike("personnel.full_name", `%${name}%`);
  if (type) rq = rq.eq("leave_type", type);
  if (evrak === "var") rq = rq.not("document_id", "is", null);
  if (evrak === "yok") rq = rq.is("document_id", null);

  const [{ data: recs, count }, { data: used }, { data: bals }] = await Promise.all([
    rq,
    // Kalan izin, kişinin o yılki TÜM bakiyeden düşen izinleriyle hesaplanır (filtre ve sayfadan bağımsız)
    supabase
      .from("leave_records")
      .select("personnel_id, days")
      .in("leave_type", DEDUCTING)
      .gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`)
      .limit(5000),
    supabase
      .from("leave_balances")
      .select("id, personnel_id, entitled_days, carried_days, used_days, remaining_days, personnel(id, full_name, personnel_assignments(project_id, end_date, projects(name)))")
      .eq("year", year).limit(2000),
  ]);

  const records = (recs ?? []) as unknown as RecordRow[];
  const total = count ?? 0;
  let balances = (bals ?? []) as unknown as BalanceRow[];
  if (isUuid(projectId)) balances = balances.filter((b) => b.personnel?.personnel_assignments.some((a) => a.project_id === projectId));
  if (name) {
    const needle = name.toLocaleLowerCase("tr");
    balances = balances.filter((b) => (b.personnel?.full_name ?? "").toLocaleLowerCase("tr").includes(needle));
  }
  balances.sort((a, b) => (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"));

  // Kalan yıllık izin = bakiye (hak + devreden − önceden kullanılan) − bu yıl kaydedilmiş, bakiyeden düşen izin günleri
  const usedByRecords = new Map<string, number>();
  ((used ?? []) as { personnel_id: string; days: number }[]).forEach((r) => usedByRecords.set(r.personnel_id, (usedByRecords.get(r.personnel_id) ?? 0) + Number(r.days)));
  const balanceOf = new Map(balances.map((b) => [b.personnel_id, b]));
  const remainingFor = (personnelId: string) => {
    const b = balanceOf.get(personnelId);
    return b ? Number(b.remaining_days) - (usedByRecords.get(personnelId) ?? 0) : null;
  };

  return (
    <>
      <FilterBar
        action="/izinler"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "ad", label: "Ad Soyad", kind: "text", value: name, placeholder: "Personel adı…" },
          { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
          { name: "tur", label: "İzin türü", value: type, all: "Tümü", options: LEAVE_TYPE_INFO.map((t) => ({ value: t.code, label: t.label })) },
          { name: "evrak", label: "Evrak", value: evrak, all: "Tümü", options: [{ value: "var", label: "Evrakı var" }, { value: "yok", label: "Evrakı yok" }] },
        ]}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title={`${year} izin kayıtları`} description={`${total} kayıt · kayıtlar tek satırda gösterilir`} />
          {records.length === 0 ? (
            <EmptyState
              title={name || type || evrak || isUuid(projectId) ? "Filtrelere uyan izin kaydı yok" : "Bu yıl için izin kaydı yok"}
              description={manage ? "“İzin evrakı ekle” sekmesinden izin ve imzalı evrakı birlikte kaydedebilirsiniz." : undefined}
            />
          ) : (
            <>
              <Table numeric={[5, 6]} head={["Personel", "Kategori", "Başlangıç", "Son tarih", "İşe dönüş", "Süre", "Kalan izin", "Evrak", manage ? "" : null].filter((h) => h !== null)}>
                {records.map((r) => {
                  const left = remainingFor(r.personnel_id);
                  const deducts = leaveDeducts(r.leave_type);
                  return (
                    <tr key={r.id}>
                      <td className={td}>
                        <p className="font-medium">{r.personnel?.full_name}</p>
                        <p className="text-xs text-muted">{r.projects?.name}</p>
                      </td>
                      <td className={td}>
                        <Badge tone={deducts ? "brand" : "neutral"}>{LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type}</Badge>
                        {!deducts && <p className="mt-1 text-xs text-muted">bakiyeden düşmez</p>}
                      </td>
                      <td className={td}>{formatDate(r.start_date)}</td>
                      <td className={td}>{formatDate(r.end_date)}</td>
                      <td className={td}>{formatDate(r.return_date)}</td>
                      <td className={cn(tdNum, "font-medium")}>{formatNumber(r.days)} gün</td>
                      <td className={cn(tdNum, "font-semibold", left !== null && left < 0 && "text-danger")}>{left === null ? "—" : `${formatNumber(left)} gün`}</td>
                      <td className={td}><LeaveDocCell recordId={r.id} projectId={r.project_id} documentId={r.document_id} canManage={manage} /></td>
                      {manage && (
                        <td className={td}>
                          <form action={deleteLeaveRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label="İzin kaydını sil"><Trash2 className="size-4" aria-hidden /></button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </Table>
              <Pagination path="/izinler" searchParams={sp} total={total} />
            </>
          )}
        </Card>

        <Card>
          <CardHeader
            title={`${year} yıllık izin bakiyeleri`}
            description="Hak edilen, devreden ve kullanılan; kalan = hak + devreden − kullanılan. Yıllık izin kaydedilince bakiye yoksa yasal hakla açılır."
            action={manage && isUuid(projectId) ? <Link href={`/projeler/${projectId}/izinler`} className="text-sm font-medium text-brand">Bakiye gir</Link> : undefined}
          />
          {balances.length === 0 ? (
            <EmptyState title="Bu yıl için izin bakiyesi yok" />
          ) : (
            <Table numeric={[2, 3, 4, 5]} head={["Personel", "Proje", "Hak edilen", "Devreden", "Kullanılan", "Kalan (kayıtlar dahil)"]}>
              {balances.map((b) => {
                const left = remainingFor(b.personnel_id) ?? Number(b.remaining_days);
                return (
                  <tr key={b.id}>
                    <td className={cn(td, "font-medium")}>{b.personnel?.full_name}</td>
                    <td className={cn(td, "text-muted")}>{[...new Set((b.personnel?.personnel_assignments ?? []).filter((a) => !a.end_date).map((a) => a.projects?.name).filter(Boolean))].join(", ") || "—"}</td>
                    <td className={tdNum}>{formatNumber(b.entitled_days)}</td>
                    <td className={tdNum}>{formatNumber(b.carried_days)}</td>
                    <td className={tdNum}>{formatNumber(Number(b.used_days) + (usedByRecords.get(b.personnel_id) ?? 0))}</td>
                    <td className={cn(tdNum, "font-semibold", left < 0 && "text-danger")}>{formatNumber(left)}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
