import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Card, CardHeader, EmptyState, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { AdvanceForm, DeleteAdvanceButton } from "@/components/payroll/advance-form";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { currentPeriod, monthBounds, projectsWith, requirePayrollAccess } from "@/lib/payroll";
import { periodLabel, tl } from "@/lib/payroll-shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatDate, isoDayInTurkey } from "@/lib/format";

export const metadata: Metadata = { title: "Avanslar" };

type Row = { id: string; personnel_id: string; project_id: string; paid_on: string; period_year: number; period_month: number; amount: number; note: string | null };

/**
 * Avanslar: ay içinde personele verilen avans girilir (proje → personel, tarih, tutar); ödeme tarihinin ayındaki
 * maaştan otomatik düşülür. Liste proje / ay / personel adına göre süzülür. Onaylı (kilitli) ayın avansı silinemez.
 */
export default async function AdvancesPage({ searchParams }: PageProps<"/bordrolar/avans">) {
  const user = await requirePayrollAccess(["payroll.advances", "payroll.read"]);
  const sp = await searchParams;
  const projects = await getAccessibleProjects();
  const now = currentPeriod();
  const projectId = isUuid(str1(sp.proje)) && projects.some((p) => p.id === str1(sp.proje)) ? str1(sp.proje) : undefined;
  // ilk açılış: bu ay; filtre gönderildiyse "Tümü" (boş) da seçilebilir
  const rawY = typeof sp.yil === "string" ? sp.yil : undefined;
  const rawM = typeof sp.ay === "string" ? sp.ay : undefined;
  const first = rawY === undefined && rawM === undefined;
  const month = first ? now.month : /^\d{1,2}$/.test(rawM ?? "") && Number(rawM) >= 1 && Number(rawM) <= 12 ? Number(rawM) : undefined;
  const year = first ? now.year : /^\d{4}$/.test(rawY ?? "") ? Number(rawY) : month ? now.year : undefined;
  const name = str1(sp.ad)?.replace(/[%_*,()]/g, "").trim() || undefined;

  // Avans girebildiği projeler (müşteride proje bazında yetki)
  const writable = await projectsWith(user, "payroll.advances", projects.map((p) => p.id));
  const writeProjects = projects.filter((p) => writable === null || writable.has(p.id));

  const admin = createAdminClient();
  const db = await createClient();

  // Form için: avans girilebilen projelerde görevli (aktif) personel
  const { data: asg } = writeProjects.length
    ? await admin
        .from("personnel_assignments")
        .select("personnel_id, project_id, personnel(full_name)")
        .in("project_id", writeProjects.map((p) => p.id))
        .is("end_date", null)
        .limit(5000)
    : { data: [] };
  const people = ((asg ?? []) as unknown as { personnel_id: string; project_id: string; personnel: { full_name: string } | null }[])
    .map((a) => ({ value: a.personnel_id, label: a.personnel?.full_name ?? "—", project_id: a.project_id }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));

  // Ad filtresi: eşleşen personelin kimlikleri (servis anahtarıyla; avans satırlarını RLS süzer)
  let nameIds: string[] | null = null;
  if (name) {
    const { data } = await admin.from("personnel").select("id").ilike("full_name", `%${name}%`).limit(500);
    nameIds = ((data ?? []) as { id: string }[]).map((p) => p.id);
  }

  let q = db.from("pay_advances").select("id, personnel_id, project_id, paid_on, period_year, period_month, amount, note").order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  if (projectId) q = q.eq("project_id", projectId);
  if (year && month) {
    const b = monthBounds(year, month);
    q = q.gte("paid_on", b.start).lte("paid_on", b.end);
  } else if (year) q = q.gte("paid_on", `${year}-01-01`).lte("paid_on", `${year}-12-31`);
  if (nameIds) q = nameIds.length ? q.in("personnel_id", nameIds) : q.eq("personnel_id", "00000000-0000-0000-0000-000000000000");
  const { data } = await q;
  const rows = (data ?? []) as Row[];

  // adlar ve kilitli aylar
  const ids = [...new Set(rows.map((r) => r.personnel_id))];
  const [{ data: names }, { data: locked }] = await Promise.all([
    ids.length ? admin.from("personnel").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] }),
    rows.length
      ? db.from("payroll_runs").select("project_id, period_year, period_month").eq("status", "approved").in("project_id", [...new Set(rows.map((r) => r.project_id))])
      : Promise.resolve({ data: [] }),
  ]);
  const nameOf = new Map(((names ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const lockedSet = new Set(((locked ?? []) as { project_id: string; period_year: number; period_month: number }[]).map((r) => `${r.project_id}:${r.period_year}:${r.period_month}`));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const canWrite = writeProjects.length > 0;

  return (
    <div className="space-y-6">
      {canWrite && (
        <Card>
          <CardHeader title="Avans gir" description="Ödeme tarihinin ayındaki maaştan otomatik düşülür. O ayın bordrosu onaylandıysa (kilitli) avans girilemez." />
          <AdvanceForm
            projects={writeProjects.map((p) => ({ value: p.id, label: p.name }))}
            people={people}
            today={isoDayInTurkey()}
            defaultProject={projectId && writeProjects.some((p) => p.id === projectId) ? projectId : undefined}
          />
        </Card>
      )}

      <div>
        <FilterBar
          action="/bordrolar/avans"
          fields={[
            { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
            { name: "ay", label: "Ay", value: month ? String(month) : "", all: "Tümü", options: MONTHS.map((n, i) => ({ value: String(i + 1), label: n })) },
            { name: "yil", label: "Yıl", value: year ? String(year) : "", all: "Tümü", options: yearOptions() },
            { name: "ad", label: "Personel", kind: "text", value: name, placeholder: "Ad soyad…" },
          ]}
        />
        <Card>
          <CardHeader
            title={year && month ? `${periodLabel(year, month)} avansları` : year ? `${year} avansları` : "Avanslar"}
            description={`${rows.length} kayıt · Toplam ${tl(total)} ₺`}
          />
          {rows.length === 0 ? (
            <EmptyState title="Avans kaydı yok" description={canWrite ? "Yukarıdaki formdan avans girebilirsiniz." : undefined} />
          ) : (
            <Table numeric={[3]} head={["Personel", "Proje", "Ödeme tarihi", "Tutar", "Bordro ayı", "Açıklama", ""]}>
              {rows.map((r) => {
                const isLocked = lockedSet.has(`${r.project_id}:${r.period_year}:${r.period_month}`);
                const canDel = !isLocked && (writable === null || writable.has(r.project_id));
                return (
                  <tr key={r.id}>
                    <td className={cn(td, "font-medium")}>{nameOf.get(r.personnel_id) ?? "—"}</td>
                    <td className={cn(td, "text-muted")}>{projectName.get(r.project_id) ?? "—"}</td>
                    <td className={td}>{formatDate(r.paid_on)}</td>
                    <td className={cn(tdNum, "font-semibold")}>{tl(r.amount)} ₺</td>
                    <td className={td}>{periodLabel(r.period_year, r.period_month)}</td>
                    <td className={cn(td, "max-w-xs text-muted")}>{r.note ?? "—"}</td>
                    <td className={cn(td, "text-right")}>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted" title="Bu ayın bordrosu onaylandı; avans değiştirilemez.">
                          <Lock className="size-3.5" aria-hidden /> Kilitli
                        </span>
                      ) : canDel ? (
                        <DeleteAdvanceButton id={r.id} label={`${nameOf.get(r.personnel_id) ?? "Personel"} · ${formatDate(r.paid_on)} · ${tl(r.amount)} ₺`} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
