import type { Metadata } from "next";
import { CalendarCheck2, Lock } from "lucide-react";
import { Card, CardHeader, EmptyState, Notice } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { PayrollTable } from "@/components/payroll/payroll-table";
import { RunToolbar, StartRunButton } from "@/components/payroll/run-actions";
import { hasPermission } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { currentPeriod, loadPayrollRun, projectsWith, requirePayrollAccess } from "@/lib/payroll";
import { periodLabel, tl } from "@/lib/payroll-shared";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Maaş hesaplama" };

/**
 * Ay sonu maaş hesaplama: proje + ay seçilir. Dönem yoksa "başlat" (o ay projede görevli herkes listelenir);
 * varsa müşterinin Excel düzenindeki tablo (gün alanları ve merkezde kesintiler girilir, tutarları veritabanı
 * hesaplar), onay/kilit ve indirmeler.
 */
export default async function PayrollCalcPage({ searchParams }: PageProps<"/bordrolar/maas">) {
  const user = await requirePayrollAccess(["payroll.run", "payroll.read"]);
  const sp = await searchParams;
  const projects = await getAccessibleProjects();
  const now = currentPeriod();
  const y = Number(str1(sp.yil));
  const m = Number(str1(sp.ay));
  const year = Number.isInteger(y) && y >= 2020 && y <= 2100 ? y : now.year;
  const month = Number.isInteger(m) && m >= 1 && m <= 12 ? m : now.month;
  const asked = str1(sp.proje);
  const projectId = isUuid(asked) && projects.some((p) => p.id === asked) ? asked : projects[0]?.id;

  const filter = (
    <FilterBar
      action="/bordrolar/maas"
      fields={[
        { name: "proje", label: "Proje", value: projectId, options: projects.map((p) => ({ value: p.id, label: user.kind === "staff" && p.organizations ? `${p.name} · ${p.organizations.name}` : p.name })), searchable: projects.length > 8 },
        { name: "ay", label: "Ay", value: String(month), options: MONTHS.map((name, i) => ({ value: String(i + 1), label: name })) },
        { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
      ]}
    />
  );
  if (!projectId) {
    return (
      <>
        {filter}
        <Card><EmptyState title="Erişebildiğiniz proje yok" description="Maaş hesaplamak için hesabınıza proje tanımlanmalı." /></Card>
      </>
    );
  }

  const db = await createClient();
  const [{ data: runRow }, runSet] = await Promise.all([
    db.from("payroll_runs").select("id").eq("project_id", projectId).eq("period_year", year).eq("period_month", month).maybeSingle(),
    projectsWith(user, "payroll.run", [projectId]),
  ]);
  const canRun = runSet === null || runSet.has(projectId);
  const canManage = user.kind === "staff" && hasPermission(user, "payroll.manage");
  const project = projects.find((p) => p.id === projectId)!;
  const title = `${project.name} · ${periodLabel(year, month)}`;

  if (!runRow) {
    return (
      <>
        {filter}
        <Card>
          <CardHeader title={title} description="Bu ay için bordro henüz başlatılmamış." />
          <div className="space-y-4 p-5">
            {canRun ? (
              <>
                <p className="max-w-2xl text-sm text-muted">
                  Başlatınca o ay projede görevli tüm personel listelenir. Her personelin tutarları merkezin girdiği ücret
                  tanımlarından, o ay girilen avanslar da avans kayıtlarından gelir. Siz yalnızca eksik günleri girersiniz.
                </p>
                <StartRunButton projectId={projectId} year={year} month={month} label={`${periodLabel(year, month)} bordrosunu başlat`} />
              </>
            ) : (
              <p className="text-sm text-muted">Bu dönemin bordrosu hazırlandığında burada görünür.</p>
            )}
          </div>
        </Card>
      </>
    );
  }

  const run = await loadPayrollRun(db, runRow.id);
  if (!run) return filter;
  const locked = run.status === "approved";
  const missingRates = run.lines.filter((l) => !l.has_rates).length;
  const negative = run.lines.filter((l) => l.bank_paid < 0).length;
  const net = run.lines.reduce((s, l) => s + Number(l.net_paid), 0);

  return (
    <>
      {filter}
      <div className="space-y-4">
        {locked ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-success/30 bg-success-soft px-5 py-4 text-success">
            <Lock className="size-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold">
              Onaylandı · {formatDateTime(run.approvedAt)}
              {run.approvedBy ? ` · ${run.approvedBy}` : ""}
              <span className="block font-normal">Bu dönem kilitli.{canManage ? " Düzeltme için “Kilidi aç”." : " Düzeltme gerekirse merkezden kilidin açılmasını isteyin."}</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-card">
            <CalendarCheck2 className="size-5 shrink-0 text-brand" aria-hidden />
            <p className="text-sm">
              <span className="font-semibold">Taslak.</span> Günleri girip kaydedin; kontrol ettikten sonra “Onayla ve kilitle”.
            </p>
          </div>
        )}
        {missingRates > 0 && (
          <Notice tone="danger">
            {missingRates} personelin ücret tanımı yok; tutarları 0 hesaplanıyor. {canManage ? "Ücret tanımları sekmesinden girin." : "Merkezden ücret tanımlarının girilmesini isteyin."}
          </Notice>
        )}
        {negative > 0 && <Notice tone="warning">{negative} personelde kesintiler (avans dahil) bankadan ödenecek tutarı aşıyor; bankadan ödenen eksiye düştü.</Notice>}

        <Card>
          <CardHeader
            title={title}
            description={`${run.lines.length} personel · Net ödenecek toplam ${tl(net)} ₺`}
            action={<RunToolbar runId={run.id} locked={locked} canRun={canRun} canUnlock={canManage} title={`${periodLabel(year, month)} bordrosu`} count={run.lines.length} />}
          />
          {run.lines.length === 0 ? (
            <EmptyState title="Bu dönemde personel yok" description="O ay projede görevli personel bulunamadı. Personel atandıysa “Eksik personeli ekle”ye basın." />
          ) : (
            <PayrollTable runId={run.id} lines={run.lines} editDays={!locked && canRun} editDeductions={!locked && canManage} />
          )}
        </Card>
        <p className="px-1 text-xs text-muted">
          Hesap: normal = net maaş ÷ 30 × çalışılan gün · yol = aylık yol ÷ 30 × çalışılan gün · fazla mesai = aylık fazla mesai ÷ 30 × çalışılan gün ·
          yemek kartı = aylık yemek kartı ÷ 30 × çalışılan gün · net ödenen = kazançlar − (avans + ihbar + BES + diğer) · bankadan = net ödenen − yemek kartı.
        </p>
      </div>
    </>
  );
}
