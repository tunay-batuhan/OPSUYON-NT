import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Download, Eye, EyeOff, Trash2 } from "lucide-react";
import { Card, CardHeader, EmptyState, Table, cn, td } from "@/components/ui";
import { FilterBar, yearOptions, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { ViewButton } from "@/components/doc-viewer";
import { MONTHS, formatBytes, formatDate, formatPeriod } from "@/lib/format";
import { str1 } from "@/lib/lookups";
import { PAGE_SIZE, pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { DocumentCategory, DocumentRow } from "@/lib/types";
import { deleteDocument, setDocumentVisibility } from "@/app/actions/documents";
import { UploadForm } from "./upload-form";

type Row = DocumentRow & { personnel: { full_name: string } | null };
type Group = { rows: Row[]; count: number };

/** PostgREST `ilike` içinde anlamı olan karakterleri temizler. */
const likeTerm = (s: string) => s.replace(/[%_*,()\\"]/g, "").trim();
const intIn = (v: string | undefined, min: number, max: number) => {
  const n = Number(v);
  return v && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};

/**
 * Belgeler, ait oldukları belge türünün altında gruplanarak listelenir.
 * "Tümü" görünümünde her türden en yeni 10 belge + "Tümünü gör"; tek tür seçiliyken 10'ar sayfalanır.
 */
export default async function DocumentsPage({ params, searchParams }: PageProps<"/projeler/[id]/belgeler">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(id);
  const manage = can(ctx, "documents.manage");
  const base = `/projeler/${id}/belgeler`;

  const supabase = await createClient();
  const { data: cats } = await supabase.from("document_categories").select("*").eq("is_active", true).order("sort_order");
  const categories = ((cats ?? []) as DocumentCategory[]).filter((c) => manage || can(ctx, c.permission_code));
  if (categories.length === 0) notFound();

  const active = typeof sp.kategori === "string" && categories.some((c) => c.code === sp.kategori) ? sp.kategori : undefined;
  const shown = active ? categories.filter((c) => c.code === active) : categories;
  // Ay / Yıl yalnızca dönemli türlerde (bordro, puantaj…), Personel yalnızca personel belgelerinde anlamlıdır
  const periodic = shown.some((c) => c.requires_period);
  const personal = shown.some((c) => c.scope === "personnel");

  const belge = (str1(sp.belge) ?? "").trim();
  const personel = personal ? (str1(sp.personel) ?? "").trim() : "";
  const belgeTerm = likeTerm(belge);
  const personelTerm = likeTerm(personel);
  const month = periodic ? intIn(str1(sp.ay), 1, 12) : undefined;
  const year = periodic ? intIn(str1(sp.yil), 2000, 2100) : undefined;
  const gorunum = manage && (sp.gorunum === "yayinda" || sp.gorunum === "gizli") ? sp.gorunum : undefined;
  const filtered = Boolean(belgeTerm || personelTerm || month || year || gorunum);
  const paging = pagingFrom(sp);

  /** Bir belge türünün süzülmüş sorgusu — "page": seçili türün sayfası, "preview": Tümü görünümünde ilk 10, "count": yalnızca sayı. */
  const query = (code: string, mode: "page" | "preview" | "count") => {
    let q = supabase
      .from("documents")
      // Personel adıyla aranırken yalnızca o personele bağlı belgeler gelsin (inner join)
      .select(personelTerm ? "*, personnel!inner(full_name)" : "*, personnel(full_name)", { count: "exact", head: mode === "count" })
      .eq("project_id", id)
      .eq("category_code", code);
    if (belgeTerm) q = q.ilike("title", `%${belgeTerm}%`);
    if (personelTerm) q = q.ilike("personnel.full_name", `%${personelTerm}%`);
    if (year) q = q.eq("period_year", year);
    if (month) q = q.eq("period_month", month);
    if (gorunum) q = q.eq("customer_visible", gorunum === "yayinda");
    if (mode === "count") return q;
    return q
      .order("period_year", { ascending: false, nullsFirst: false })
      .order("period_month", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(mode === "page" ? paging.from : 0, mode === "page" ? paging.to : PAGE_SIZE - 1);
  };

  const results = await Promise.all(categories.map((c) => query(c.code, !active ? "preview" : c.code === active ? "page" : "count")));
  const groups = new Map<string, Group>(
    categories.map((c, i) => [c.code, { rows: (results[i].data ?? []) as unknown as Row[], count: results[i].count ?? 0 }]),
  );
  const countOf = (code: string) => groups.get(code)?.count ?? 0;
  const total = categories.reduce((n, c) => n + countOf(c.code), 0);

  if (active && paging.page > 1 && !groups.get(active)?.rows.length) {
    redirect(pageHref(base, sp, countOf(active) ? pageCount(countOf(active)) : 1));
  }

  const people = manage
    ? (((await supabase.from("personnel_assignments").select("personnel(id, full_name)").eq("project_id", id)).data ?? []) as unknown as {
        personnel: { id: string; full_name: string } | null;
      }[])
        .map((a) => a.personnel)
        .filter((p): p is { id: string; full_name: string } => Boolean(p))
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    : [];

  /** Kategori bağlantısı: filtreler korunur, o türde anlamsız olanlar (dönem / personel) düşer. */
  const hrefFor = (c?: DocumentCategory) => {
    const next: Record<string, string | string[] | undefined> = { ...sp, kategori: c?.code };
    if (c && !c.requires_period) Object.assign(next, { ay: undefined, yil: undefined });
    if (c && c.scope !== "personnel") next.personel = undefined;
    return `${pageHref(base, next, 1)}#liste`;
  };

  const fields: FilterField[] = [{ name: "belge", label: "Belge adı", kind: "text", value: belge, placeholder: "Birkaç harf yazın…" }];
  if (personal) fields.push({ name: "personel", label: "Personel", kind: "text", value: personel, placeholder: "Ad soyad…" });
  if (periodic) {
    fields.push(
      { name: "ay", label: "Ay", value: month ? String(month) : undefined, all: "Tümü", options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
      { name: "yil", label: "Yıl", value: year ? String(year) : undefined, all: "Tümü", options: yearOptions() },
    );
  }
  if (manage) {
    fields.push({ name: "gorunum", label: "Görünürlük", value: gorunum, all: "Tümü", options: [{ value: "yayinda", label: "Yayında" }, { value: "gizli", label: "Gizli" }] });
  }

  // Boş bölümler yalnızca belirli bir tür seçiliyse veya (filtresiz) yönetici için gösterilir
  const chipCats = categories.filter((c) => c.code === active || countOf(c.code) > 0 || (manage && !filtered));
  const visible = shown.filter((c) => active || countOf(c.code) > 0 || (manage && !filtered));

  return (
    <div className="space-y-6">
      {manage && (
        <Card>
          <CardHeader title="Belge yükle" description="Yüklenen belge, 'Müşteri görebilsin' işaretlenmedikçe yalnızca merkezde görünür." />
          <UploadForm projectId={id} categories={categories} people={people} defaultCategory={active} />
        </Card>
      )}

      <div id="liste" className="scroll-mt-6 space-y-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Belge türü">
          <Link href={hrefFor()} className={chip(!active)}>Tümü ({total})</Link>
          {chipCats.map((c) => (
            <Link key={c.code} href={hrefFor(c)} className={chip(active === c.code)}>
              {c.name} ({countOf(c.code)})
            </Link>
          ))}
        </div>

        <FilterBar action={`${base}#liste`} fields={fields}>
          {active && <input type="hidden" name="kategori" value={active} />}
        </FilterBar>

        {visible.length === 0 && (
          <Card>
            <EmptyState
              title={filtered ? "Filtrelere uyan belge yok" : "Henüz belge yok"}
              description={filtered ? "Farklı harfler deneyin veya filtreleri temizleyin." : "Merkez belge paylaştığında burada görünür."}
            />
          </Card>
        )}

        {visible.map((c) => {
          const { rows, count } = groups.get(c.code) ?? { rows: [], count: 0 };
          return (
            <Card key={c.code} id={c.code}>
              <CardHeader title={c.name} description={`${count} belge`} />
              {rows.length === 0 ? (
                <EmptyState
                  title={filtered ? "Filtrelere uyan belge yok" : "Bu belge türünde belge yok"}
                  description={manage && !filtered ? "Yukarıdaki formdan yükleyebilirsiniz." : undefined}
                />
              ) : (
                <Table head={["Belge", "Personel", "Dönem", "Boyut", "Tarih", manage ? "Görünürlük" : null, ""].filter((h) => h !== null)}>
                  {rows.map((d) => (
                    <tr key={d.id}>
                      <td className={td}>
                        <p className="font-medium">{d.title}</p>
                        <p className="text-xs text-muted">{d.file_name}</p>
                      </td>
                      <td className={td}>{d.personnel?.full_name ?? "—"}</td>
                      <td className={td}>{formatPeriod(d.period_year, d.period_month)}</td>
                      <td className={td}>{formatBytes(d.size_bytes)}</td>
                      <td className={td}>{formatDate(d.created_at)}</td>
                      {manage && (
                        <td className={td}>
                          <form action={setDocumentVisibility} className="inline">
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="project_id" value={id} />
                            <input type="hidden" name="visible" value={d.customer_visible ? "0" : "1"} />
                            <button className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg" title="Müşteri görünürlüğünü değiştir">
                              {d.customer_visible ? <Eye className="size-4 text-success" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                              {d.customer_visible ? "Yayında" : "Gizli"}
                            </button>
                          </form>
                        </td>
                      )}
                      <td className={cn(td, "whitespace-nowrap text-right")}>
                        <a href={`/api/documents/${d.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-surface-2">
                          <Download className="size-4" aria-hidden /> İndir
                        </a>
                        <ViewButton src={`/api/documents/${d.id}/view`} title={d.title} downloadHref={`/api/documents/${d.id}`} className="ml-2" />
                        {manage && (
                          <form action={deleteDocument} className="ml-2 inline">
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="project_id" value={id} />
                            <button className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`${d.title} belgesini sil`}>
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
              {active ? (
                <Pagination path={base} searchParams={sp} total={count} />
              ) : (
                count > rows.length && (
                  <div className="border-t border-border px-5 py-3 text-sm">
                    <Link href={hrefFor(c)} className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                      Tümünü gör ({count}) <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                )
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const chip = (on: boolean) =>
  cn("rounded-full border px-3 py-1 text-sm", on ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-fg");
