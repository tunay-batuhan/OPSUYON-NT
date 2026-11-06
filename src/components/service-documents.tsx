import { Card, CardHeader, EmptyState, PageHeader, Table, cn, td } from "@/components/ui";
import { FilterBar, yearOptions, type FilterField } from "@/components/filter-bar";
import { DocPreview, DownloadLink } from "@/components/doc-ui";
import { Pagination } from "@/components/pagination";
import { getAccessibleProjects, getHatOptions, isUuid, str1 } from "@/lib/lookups";
import { pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatBytes, formatDate, formatPeriod } from "@/lib/format";

type Row = {
  id: string; title: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  period_year: number | null; period_month: number | null; created_at: string;
  projects: { name: string; service_line: string } | null;
};

/**
 * Hizmet (Güvenlik / Temizlik / Danışma / Teknik Personel) ve dönem filtresiyle, hizmet/proje bazlı belgeler.
 * Bordro (toplu), Puantaj, Faturalar, Cari Ekstre, Risk Analizi için ortak ekran.
 */
export async function ServiceDocuments({
  category, title, description, path, searchParams, filters = { hat: true, period: true }, preview = false, emptyText, section,
}: {
  category: string;
  title: string;
  description: string;
  path: string;
  searchParams: Record<string, string | string[] | undefined>;
  filters?: { hat?: boolean; project?: boolean; period?: boolean };
  /** İlk (veya seçilen) belgeyi sayfada göster */
  preview?: boolean;
  emptyText?: string;
  /** Bölüm sayfası: başlık bölüm adı olur, altına sekmeler gelir (ör. Cari Hesap › Faturalar). */
  section?: { title: string; tabs: React.ReactNode };
}) {
  const hat = str1(searchParams.hat);
  const projectId = str1(searchParams.proje);
  const month = str1(searchParams.ay);
  const year = str1(searchParams.yil);
  const selected = str1(searchParams.belge);
  const { from, to } = pagingFrom(searchParams);

  const supabase = await createClient();
  let q = supabase
    .from("documents")
    .select("id, title, file_name, mime_type, size_bytes, period_year, period_month, created_at, projects!inner(name, service_line)", { count: "exact" })
    .eq("category_code", category)
    .order("period_year", { ascending: false, nullsFirst: false })
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (hat) q = q.eq("projects.service_line", hat);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  if (month) q = q.eq("period_month", Number(month));
  if (year) q = q.eq("period_year", Number(year));
  const { data, count } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;

  // "Görüntüle": mevcut filtre ve sayfa korunur, yalnızca seçili belge değişir
  const viewHref = (id: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v !== "" && k !== "belge") p.set(k, v);
    p.set("belge", id);
    return `${path}?${p.toString()}`;
  };

  const fields: FilterField[] = [];
  if (filters.hat) fields.push({ name: "hat", label: "Hizmet", value: hat, all: "Tümü", options: await getHatOptions() });
  if (filters.project) fields.push({ name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: (await getAccessibleProjects()).map((p) => ({ value: p.id, label: p.name })) });
  if (filters.period) {
    fields.push(
      { name: "ay", label: "Ay", value: month, all: "Tümü", options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
      { name: "yil", label: "Yıl", value: year, all: "Tümü", options: yearOptions() },
    );
  }

  // Önizleme: seçili belge bu sayfadaysa o, değilse sayfadaki ilk belge
  const shown = preview ? (rows.find((r) => r.id === selected) ?? rows[0]) : undefined;

  return (
    <>
      <PageHeader title={section?.title ?? title} description={description} />
      {section?.tabs}
      {fields.length > 0 && <FilterBar action={path} fields={fields} />}

      <Card>
        <CardHeader title={`${total} belge`} />
        {rows.length === 0 ? (
          <EmptyState title="Belge bulunamadı" description={emptyText ?? "Seçtiğiniz filtreler için yüklenmiş belge yok."} />
        ) : (
          <>
            <Table head={["Belge", "Hizmet / proje", "Dönem", "Boyut", "Yükleme", ""]}>
              {rows.map((d) => (
                <tr key={d.id} className={cn(shown?.id === d.id && "bg-brand-soft/40")}>
                  <td className={td}>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted">{d.file_name}</p>
                  </td>
                  <td className={td}>{d.projects?.name}</td>
                  <td className={td}>{formatPeriod(d.period_year, d.period_month)}</td>
                  <td className={td}>{formatBytes(d.size_bytes)}</td>
                  <td className={td}>{formatDate(d.created_at)}</td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    {preview && shown?.id !== d.id && (
                      <a href={viewHref(d.id)} className="mr-2 text-sm font-medium text-brand hover:underline">
                        Görüntüle
                      </a>
                    )}
                    <DownloadLink id={d.id} title={d.title} view={!preview} />
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination path={path} searchParams={searchParams} total={total} />
          </>
        )}
      </Card>

      {shown && (
        <div className="mt-6">
          <DocPreview id={shown.id} title={shown.title} fileName={shown.file_name} mime={shown.mime_type} />
        </div>
      )}
    </>
  );
}
