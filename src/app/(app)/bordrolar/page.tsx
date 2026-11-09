import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, Table, cn, td } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { DownloadLink } from "@/components/doc-ui";
import { DeleteDocButton } from "@/components/delete-doc-button";
import { Pagination } from "@/components/pagination";
import { ServiceDocuments } from "@/components/service-documents";
import { hasPermission } from "@/lib/auth";
import { requireAccess } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatDate, formatPeriod } from "@/lib/format";

export const metadata: Metadata = { title: "Bordrolar" };

type Row = {
  id: string; title: string; file_name: string; period_year: number | null; period_month: number | null;
  created_at: string; customer_visible: boolean;
  projects: { name: string; organizations: { name: string } | null } | null;
  personnel: { full_name: string } | null;
};

const isSheet = (fileName: string) => /\.(xlsx?|csv)$/i.test(fileName);

export default async function PayrollPage({ searchParams }: PageProps<"/bordrolar">) {
  const user = await requireAccess("personel_bordro", "payroll.read");
  const sp = await searchParams;
  if (user.kind === "customer") {
    return (
      <ServiceDocuments
        category="bordro"
        title="Bordrolar"
        description=""
        headless
        path="/bordrolar"
        searchParams={sp}
        filters={{ hat: true, period: true }}
        preview
        emptyText="Seçtiğiniz hizmet ve dönem için bordro yüklenmemiş."
      />
    );
  }

  // Merkez: tüm projelerin bordroları; ekleme "Bordro ekle" sekmesinde, silme satırda
  const projectId = str1(sp.proje);
  const orgId = str1(sp.firma);
  const month = str1(sp.ay);
  const year = str1(sp.yil);
  const title = str1(sp.baslik)?.replace(/[%_*,()]/g, "").trim() || undefined;
  const visibility = str1(sp.durum);
  const manage = hasPermission(user, "documents.manage");
  const { from, to } = pagingFrom(sp);

  const supabase = await createClient();
  let q = supabase
    .from("documents")
    .select("id, title, file_name, period_year, period_month, created_at, customer_visible, projects!inner(name, organization_id, organizations(name)), personnel(full_name)", { count: "exact" })
    .eq("category_code", "bordro");
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  if (isUuid(orgId)) q = q.eq("projects.organization_id", orgId);
  if (month && /^\d{1,2}$/.test(month)) q = q.eq("period_month", Number(month));
  if (year && /^\d{4}$/.test(year)) q = q.eq("period_year", Number(year));
  if (title) q = q.ilike("title", `%${title}%`);
  if (visibility === "yayinda") q = q.eq("customer_visible", true);
  if (visibility === "gizli") q = q.eq("customer_visible", false);

  const [{ data, count }, projects, { data: orgs }] = await Promise.all([
    q
      .order("period_year", { ascending: false, nullsFirst: false })
      .order("period_month", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to),
    getAccessibleProjects(),
    supabase.from("organizations").select("id, name").order("name"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const filtered = Boolean(projectId || orgId || month || year || title || visibility);

  return (
    <>
      <FilterBar
        action="/bordrolar"
        fields={[
          { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "firma", label: "Firma", value: orgId, all: "Tüm firmalar", options: ((orgs ?? []) as { id: string; name: string }[]).map((o) => ({ value: o.id, label: o.name })) },
          { name: "ay", label: "Ay", value: month, all: "Tümü", options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
          { name: "yil", label: "Yıl", value: year, all: "Tümü", options: yearOptions() },
          { name: "baslik", label: "Başlık", kind: "text", value: title, placeholder: "Belge adı…" },
          { name: "durum", label: "Görünürlük", value: visibility, all: "Tümü", options: [{ value: "yayinda", label: "Yayında" }, { value: "gizli", label: "Gizli" }] },
        ]}
      />
      <Card>
        <CardHeader title={`${total} bordro`} description="Dönem sırasıyla, en yeni üstte" />
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "Filtrelere uyan bordro yok" : "Henüz bordro yüklenmemiş"}
            description={manage ? "“Bordro ekle” sekmesinden proje ve dönem seçip dosya yükleyebilirsiniz." : undefined}
          />
        ) : (
          <>
            <Table head={["Belge", "Proje", "Firma", "Dönem", "Yükleme tarihi", "Durum", ""]}>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className={td}>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted">{d.personnel ? `${d.personnel.full_name} · ${d.file_name}` : d.file_name}</p>
                  </td>
                  <td className={td}>{d.projects?.name}</td>
                  <td className={cn(td, "text-muted")}>{d.projects?.organizations?.name ?? "—"}</td>
                  <td className={td}>{formatPeriod(d.period_year, d.period_month)}</td>
                  <td className={td}>{formatDate(d.created_at)}</td>
                  <td className={td}><Badge tone={d.customer_visible ? "success" : "neutral"}>{d.customer_visible ? "Yayında" : "Gizli"}</Badge></td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    <DownloadLink id={d.id} title={d.title} label={isSheet(d.file_name) ? "Excel indir" : "PDF indir"} />
                    {manage && <DeleteDocButton id={d.id} title={d.title} back="/bordrolar" className="ml-2" />}
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination path="/bordrolar" searchParams={sp} total={total} />
          </>
        )}
      </Card>
    </>
  );
}
