import type { Metadata } from "next";
import { Card, CardHeader, EmptyState, Notice } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { RatesRow, type RatesRowData } from "@/components/payroll/rates-row";
import { hasPermission } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { projectsWith, requirePayrollAccess } from "@/lib/payroll";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ücret tanımları" };

type Asg = { personnel_id: string; project_id: string; personnel: { full_name: string; title: string | null } | null };

/**
 * Ücret tanımları: projede görevli (aktif) personelin net maaş, aylık yol, aylık fazla mesai, aylık yemek kartı ve
 * ek ödemesi (hepsi net; maaş, yol, fazla mesai ve yemek kartı eksik gün kadar ÷ 30 orantılı düşer). Yalnızca merkez (payroll.manage) düzenler; müşteri görür.
 */
export default async function PayRatesPage({ searchParams }: PageProps<"/bordrolar/ucretler">) {
  const user = await requirePayrollAccess(["payroll.manage", "payroll.read"]);
  const sp = await searchParams;
  const editable = user.kind === "staff" && hasPermission(user, "payroll.manage");
  const all = await getAccessibleProjects();
  // müşteri: yalnızca bordro görme yetkisi olduğu projeler
  const readable = await projectsWith(user, "payroll.read", all.map((p) => p.id));
  const projects = all.filter((p) => readable === null || readable.has(p.id) || editable);

  const projectId = isUuid(str1(sp.proje)) && projects.some((p) => p.id === str1(sp.proje)) ? str1(sp.proje) : undefined;
  const orgName = user.kind === "staff" ? str1(sp.firma) : undefined;
  const name = str1(sp.ad)?.replace(/[%_*,()]/g, "").trim() || undefined;
  const missingOnly = str1(sp.durum) === "eksik";

  const scope = projects.filter((p) => (!projectId || p.id === projectId) && (!orgName || p.organizations?.name === orgName));
  const admin = createAdminClient();
  const { data } = scope.length
    ? await (() => {
        let q = admin
          .from("personnel_assignments")
          .select(`personnel_id, project_id, ${name ? "personnel!inner" : "personnel"}(full_name, title)`)
          .in("project_id", scope.map((p) => p.id))
          .is("end_date", null)
          .limit(3000);
        if (name) q = q.ilike("personnel.full_name", `%${name}%`);
        return q;
      })()
    : { data: [] };
  const asg = (data ?? []) as unknown as Asg[];
  const ids = [...new Set(asg.map((a) => a.personnel_id))];

  // ücretler kullanıcı oturumuyla (RLS: payroll.read / payroll.manage)
  const db = await createClient();
  const { data: rateRows } = ids.length
    ? await db.from("pay_rates").select("personnel_id, net_salary, transport_monthly, support_monthly, overtime_monthly, meal_monthly, bes_monthly, extra_monthly, extra_label, updated_at").in("personnel_id", ids)
    : { data: [] };
  const rateOf = new Map(((rateRows ?? []) as (NonNullable<RatesRowData["rates"]> & { personnel_id: string })[]).map((r) => [r.personnel_id, r]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const rows: RatesRowData[] = asg
    .map((a) => {
      const r = rateOf.get(a.personnel_id);
      return {
        personnel_id: a.personnel_id,
        full_name: a.personnel?.full_name ?? "—",
        title: a.personnel?.title ?? null,
        project: projectName.get(a.project_id) ?? "",
        rates: r
          ? {
              net_salary: Number(r.net_salary), transport_monthly: Number(r.transport_monthly), support_monthly: Number(r.support_monthly),
              overtime_monthly: Number(r.overtime_monthly), meal_monthly: Number(r.meal_monthly), bes_monthly: Number(r.bes_monthly), extra_monthly: Number(r.extra_monthly),
              extra_label: r.extra_label, updated_at: r.updated_at,
            }
          : null,
      };
    })
    .filter((r) => !missingOnly || !r.rates)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));
  const missing = rows.filter((r) => !r.rates).length;
  const orgs = [...new Set(projects.map((p) => p.organizations?.name).filter(Boolean))] as string[];

  return (
    <>
      <FilterBar
        action="/bordrolar/ucretler"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          ...(user.kind === "staff" ? [{ name: "firma", label: "Firma", value: orgName, all: "Tüm firmalar", options: orgs.sort((a, b) => a.localeCompare(b, "tr")).map((o) => ({ value: o, label: o })) }] : []),
          { name: "ad", label: "Personel", kind: "text" as const, value: name, placeholder: "Ad soyad…" },
          { name: "durum", label: "Tanım", value: missingOnly ? "eksik" : "", all: "Tümü", options: [{ value: "eksik", label: "Tanımı olmayanlar" }] },
        ]}
      />
      <div className="space-y-4">
        {!editable && <Notice tone="brand">Ücret tanımlarını merkez girer; değişiklik için merkezle iletişime geçin.</Notice>}
        <Card>
          <CardHeader
            title={`${rows.length} personel`}
            description={missing ? `${missing} personelin ücret tanımı yok; bordroda tutarları 0 hesaplanır.` : "Tutarların hepsi aylık ve nettir. Değişiklik taslak bordrolara hemen yansır; onaylı bordrolar değişmez."}
          />
          {rows.length === 0 ? (
            <EmptyState title="Personel bulunamadı" description="Seçilen projelerde görevli (aktif) personel yok ya da filtreye uyan yok." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 text-left font-medium">Personel</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Net maaş</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Yol (aylık)</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Destek</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Ticket</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">F. mesai</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Ek ödeme</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">BES</th>
                    {editable && <th className="px-4 py-3"><span className="sr-only">Düzenle</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => <RatesRow key={`${r.personnel_id}-${r.rates?.updated_at ?? "yok"}`} row={r} editable={editable} />)}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
