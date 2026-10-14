import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, btn, cn, td, tdNum } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import type { Invoice } from "@/lib/types";

export const metadata: Metadata = { title: "Faturalar" };

const tone = { draft: "warning", issued: "success", cancelled: "neutral" } as const;
const label = { draft: "Taslak", issued: "Kesildi", cancelled: "İptal" } as const;

export default async function InvoicesAllPage({ searchParams }: PageProps<"/faturalar">) {
  const user = await requireUser();
  const sp = await searchParams;
  const projectId = str1(sp.proje);
  const year = str1(sp.yil);
  const status = str1(sp.durum);
  const projects = await getAccessibleProjects();

  const supabase = await createClient();
  let q = supabase.from("invoices").select("*, projects(name)").order("issue_date", { ascending: false }).limit(1000);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  if (year) q = q.gte("issue_date", `${year}-01-01`).lte("issue_date", `${year}-12-31`);
  if (status && status in label) q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as unknown as (Invoice & { projects: { name: string } | null })[];
  const live = rows.filter((r) => r.status === "issued");
  const manage = canAnywhere(user, "finance.manage");

  return (
    <>
      <PageHeader
        title="Faturalar"
        description="Aylık kesilen faturalar."
        actions={manage && isUuid(projectId) && <Link href={`/projeler/${projectId}/finans`} className={btn("primary", "md")}>Fatura / ödeme gir</Link>}
      />
      <FilterBar
        action="/faturalar"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "yil", label: "Yıl", value: year, all: "Tümü", options: yearOptions() },
          { name: "durum", label: "Durum", value: status, all: "Tümü", options: manage ? [{ value: "issued", label: "Kesildi" }, { value: "draft", label: "Taslak" }, { value: "cancelled", label: "İptal" }] : [{ value: "issued", label: "Kesildi" }] },
        ]}
      />
      <Card>
        <CardHeader title={`${rows.length} fatura`} description={`Kesilmiş fatura toplamı: ${formatMoney(live.reduce((a, r) => a + Number(r.total), 0))}`} />
        {rows.length === 0 ? (
          <EmptyState title="Fatura bulunamadı" />
        ) : (
          <Table head={["Fatura no", "Proje", "Dönem", "Tarih", "Vade", "Toplam", "Durum", ""]}>
            {rows.map((i) => (
              <tr key={i.id}>
                <td className={cn(td, "font-medium")}>{i.invoice_no}</td>
                <td className={td}>{i.projects?.name}</td>
                <td className={td}>{formatPeriod(i.period_year, i.period_month)}</td>
                <td className={td}>{formatDate(i.issue_date)}</td>
                <td className={td}>{formatDate(i.due_date)}</td>
                <td className={cn(tdNum, "font-medium")}>{formatMoney(i.total, i.currency)}</td>
                <td className={td}><Badge tone={tone[i.status]}>{label[i.status]}</Badge></td>
                <td className={cn(td, "text-right")}>
                  {i.document_id && (
                    <a href={`/api/documents/${i.document_id}`} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
                      <Download className="size-4" aria-hidden /> PDF
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
