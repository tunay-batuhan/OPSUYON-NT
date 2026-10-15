import Link from "next/link";
import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { LeaveDocCell, LeaveRecordForm } from "@/components/forms/leave-forms";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_TYPE_LABELS, formatDate, formatNumber } from "@/lib/format";
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
type AssignmentRow = { project_id: string; personnel: { id: string; full_name: string } | null; projects: { name: string } | null };

/** Üstte kayıtlı izinler (tek satır, kalan süre, evrak); altta yeni izin girişi. */
export default async function LeavesAllPage({ searchParams }: PageProps<"/izinler">) {
  const user = await requireUser();
  const sp = await searchParams;
  const year = Number(str1(sp.yil) ?? new Date().getFullYear());
  const projectId = str1(sp.proje);
  const projects = await getAccessibleProjects();
  const manage = canAnywhere(user, "leaves.manage") && user.kind === "staff";

  const supabase = await createClient();
  let rq = supabase
    .from("leave_records")
    .select("id, personnel_id, project_id, leave_type, start_date, end_date, return_date, days, note, document_id, personnel(full_name), projects(name)")
    .gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`)
    .order("start_date", { ascending: false }).limit(1000);
  if (isUuid(projectId)) rq = rq.eq("project_id", projectId);

  const [{ data: recs }, { data: bals }, assignRes] = await Promise.all([
    rq,
    supabase
      .from("leave_balances")
      .select("id, personnel_id, entitled_days, carried_days, used_days, remaining_days, personnel(id, full_name, personnel_assignments(project_id, end_date, projects(name)))")
      .eq("year", year).limit(2000),
    manage
      ? supabase.from("personnel_assignments").select("project_id, personnel(id, full_name), projects(name)").is("end_date", null).limit(2000)
      : Promise.resolve({ data: [] }),
  ]);

  const records = (recs ?? []) as unknown as RecordRow[];
  let balances = (bals ?? []) as unknown as BalanceRow[];
  if (isUuid(projectId)) balances = balances.filter((b) => b.personnel?.personnel_assignments.some((a) => a.project_id === projectId));
  balances.sort((a, b) => (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"));

  // Kalan yıllık izin = bakiye (hak + devreden − önceden kullanılan) − bu yıl kaydedilmiş yıllık izin günleri
  const usedByRecords = new Map<string, number>();
  records.filter((r) => r.leave_type === "yillik").forEach((r) => usedByRecords.set(r.personnel_id, (usedByRecords.get(r.personnel_id) ?? 0) + Number(r.days)));
  const balanceOf = new Map(balances.map((b) => [b.personnel_id, b]));
  const remainingFor = (personnelId: string) => {
    const b = balanceOf.get(personnelId);
    return b ? Number(b.remaining_days) - (usedByRecords.get(personnelId) ?? 0) : null;
  };

  const people = ((assignRes.data ?? []) as unknown as AssignmentRow[])
    .filter((a) => a.personnel && (!isUuid(projectId) || a.project_id === projectId))
    .map((a) => ({ value: `${a.personnel!.id}|${a.project_id}`, label: `${a.personnel!.full_name} — ${a.projects?.name ?? ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));

  return (
    <>
      <PageHeader title="İzin Yönetimi" description="Personelin izin kayıtları, kalan yıllık izin süresi ve izin evrakları." />
      <FilterBar
        action="/izinler"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
        ]}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title={`${year} izin kayıtları`} description={`${records.length} kayıt · kayıtlar tek satırda gösterilir`} />
          {records.length === 0 ? (
            <EmptyState title="Bu yıl için izin kaydı yok" description={manage ? "Aşağıdaki formdan izin ekleyebilirsiniz." : undefined} />
          ) : (
            <Table numeric={[5, 6]} head={["Personel", "Kategori", "Başlangıç", "Son tarih", "İşe başlama", "Süre", "Kalan izin", "Evrak", manage ? "" : null].filter((h) => h !== null)}>
              {records.map((r) => {
                const left = remainingFor(r.personnel_id);
                return (
                  <tr key={r.id}>
                    <td className={td}>
                      <p className="font-medium">{r.personnel?.full_name}</p>
                      <p className="text-xs text-muted">{r.projects?.name}</p>
                    </td>
                    <td className={td}><Badge tone={r.leave_type === "yillik" ? "brand" : "neutral"}>{LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type}</Badge></td>
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
          )}
        </Card>

        <Card>
          <CardHeader title={`${year} yıllık izin bakiyeleri`} description="Hak edilen, devreden ve kullanılan; kalan = hak + devreden − kullanılan" action={manage && isUuid(projectId) ? <Link href={`/projeler/${projectId}/izinler`} className="text-sm font-medium text-brand">Bakiye gir</Link> : undefined} />
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

        {manage && (
          <Card id="yeni">
            <CardHeader title="İzin ekle" description="Kategori, personel, tarihler ve toplam süreyi girip kaydedin; evrakı kayıttan sonra satırdan yükleyebilirsiniz." />
            <LeaveRecordForm people={people} />
          </Card>
        )}
      </div>
    </>
  );
}
