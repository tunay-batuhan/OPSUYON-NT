import type { Metadata } from "next";
import { CalendarCheck2, Hourglass, Lock } from "lucide-react";
import { Card, CardHeader, EmptyState, Notice } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { PayrollTable } from "@/components/payroll/payroll-table";
import { RunToolbar, StartRunButton } from "@/components/payroll/run-actions";
import { hasPermission } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { currentPeriod, loadPayrollRun, requirePayrollAccess } from "@/lib/payroll";
import { netColumn } from "@/lib/payroll-engine";
import { periodLabel, tl } from "@/lib/payroll-shared";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Maaş bordrosu" };

/**
 * Ay sonu maaş bordrosu: proje + ay seçilir. Merkez (payroll.run) dönemi başlatır, şablondaki sütunlara göre tabloyu
 * doldurur ve onaylayıp kilitler. Site yönetimi (müşteri) bordroyu ancak ONAYLANDIKTAN sonra, salt okunur görür.
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
  const staff = user.kind === "staff";

  const filter = (
    <FilterBar
      action="/bordrolar/maas"
      fields={[
        { name: "proje", label: "Proje", value: projectId, options: projects.map((p) => ({ value: p.id, label: staff && p.organizations ? `${p.name} · ${p.organizations.name}` : p.name })), searchable: projects.length > 8 },
        { name: "ay", label: "Ay", value: String(month), options: MONTHS.map((name, i) => ({ value: String(i + 1), label: name })) },
        { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
      ]}
    />
  );
  if (!projectId) {
    return (
      <>
        {filter}
        <Card><EmptyState title="Erişebildiğiniz proje yok" description="Maaş bordrosu için hesabınıza proje tanımlanmalı." /></Card>
      </>
    );
  }

  const db = await createClient();
  const { data: runRow } = await db.from("payroll_runs").select("id, status").eq("project_id", projectId).eq("period_year", year).eq("period_month", month).maybeSingle();
  const canRun = staff && hasPermission(user, "payroll.run");
  const canManage = staff && hasPermission(user, "payroll.manage");
  const project = projects.find((p) => p.id === projectId)!;
  const title = `${project.name} · ${periodLabel(year, month)}`;

  // site yönetimi: yalnızca onaylanmış (kilitli) bordro
  if (!staff && (!runRow || runRow.status !== "approved")) {
    return (
      <>
        {filter}
        <Card>
          <CardHeader title={title} />
          <div className="flex items-start gap-3 p-5 text-sm text-muted">
            <Hourglass className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>Bu dönemin bordrosu henüz onaylanmadı. Merkez bordroyu hazırlayıp onayladığında burada görünür.</p>
          </div>
        </Card>
      </>
    );
  }

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
                  Başlatınca o ay projede görevli tüm personel listelenir. Sütunlar ve formüller projenin bordro şablonundan,
                  ilk değerler ücret tanımlarından, avanslar da avans kayıtlarından gelir; her hücreyi sonradan elle değiştirebilirsiniz.
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
  const net = netColumn(run.columns);
  const missingRates = run.lines.filter((l) => !l.has_rates).length;
  const negative = net ? run.lines.filter((l) => (l.values[net.code] ?? 0) < 0).length : 0;
  const overridden = run.lines.filter((l) => l.overridden.length > 0).length;

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
              <span className="block font-normal">Bu dönem kilitli{staff ? "; site yönetimi bordroyu görebilir." : "."}{canManage ? " Düzeltme için “Kilidi aç”." : ""}</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-card">
            <CalendarCheck2 className="size-5 shrink-0 text-brand" aria-hidden />
            <p className="text-sm">
              <span className="font-semibold">Taslak.</span> Değerleri girip kaydedin; kontrol ettikten sonra “Onayla ve kilitle”. Site yönetimi taslağı görmez.
            </p>
          </div>
        )}
        {staff && missingRates > 0 && (
          <Notice tone="danger">
            {missingRates} personelin ücret tanımı yok; ücret tanımından gelen tutarlar 0 hesaplanıyor. {canManage ? "Ücret tanımları sekmesinden girin ya da hücreleri elle doldurun." : "Merkezden ücret tanımlarının girilmesini isteyin."}
          </Notice>
        )}
        {negative > 0 && <Notice tone="warning">{negative} personelde {net?.label.toLocaleLowerCase("tr")} eksiye düştü (kesintiler kazancı aşıyor).</Notice>}
        {staff && overridden > 0 && <Notice tone="brand">{overridden} personelde formülü elle ezilmiş hücre var (tabloda sarı; dışa aktarımda * ile işaretlenir).</Notice>}

        <Card>
          <CardHeader
            title={title}
            description={`${run.lines.length} personel${net ? ` · ${net.label} toplam ${tl(run.totals[net.code])} ₺` : ""}`}
            action={<RunToolbar runId={run.id} locked={locked} canRun={canRun} canUnlock={canManage} title={`${periodLabel(year, month)} bordrosu`} count={run.lines.length} />}
          />
          {run.lines.length === 0 ? (
            <EmptyState title="Bu dönemde personel yok" description="O ay projede görevli personel bulunamadı. Personel atandıysa “Eksik personeli ekle”ye basın." />
          ) : (
            <PayrollTable key={`${run.id}-${run.columns.map((c) => c.code).join()}`} runId={run.id} columns={run.columns} lines={run.lines} editable={!locked && canRun} />
          )}
        </Card>
        {staff && (
          <p className="px-1 text-xs text-muted">
            Sütunlar ve formüller <strong>Bordro şablonu</strong> sekmesinden değiştirilir (formülü görmek için sütun başlığının üstüne gelin). Şablon değişince açık
            taslakta “Şablonu yenile”ye basın. Onaylı bordro, onaylandığı andaki şablon ve ücret tanımlarıyla donar.
          </p>
        )}
      </div>
    </>
  );
}
