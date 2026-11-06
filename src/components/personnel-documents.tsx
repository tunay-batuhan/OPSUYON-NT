import Link from "next/link";
import { ChevronDown, FilePlus2 } from "lucide-react";
import { Card, CardHeader, EmptyState, btn } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { DownloadLink } from "@/components/doc-ui";
import { hasPermission, type CurrentUser } from "@/lib/auth";
import { str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPeriod } from "@/lib/format";
import { matches } from "@/lib/text";

type Doc = {
  id: string;
  title: string;
  file_name: string;
  created_at: string;
  category_code: string;
  period_year: number | null;
  period_month: number | null;
  customer_visible: boolean;
  projects: { name: string } | null;
};
type Category = { code: string; name: string; scope: "personnel" | "project"; permission_code: string; is_active: boolean };

/**
 * Personel kartındaki "Evraklar": personelin belgeleri kategoriye göre gruplu; her grup açılır-kapanır
 * (belge varsa açık). Üstte kategori filtresi (?kategori=) ve başlık arama (?ara=).
 */
export async function PersonnelDocuments({
  personnelId, user, searchParams, uploadHref,
}: {
  personnelId: string;
  user: CurrentUser;
  searchParams: Record<string, string | string[] | undefined>;
  /** Evrak ekle bağlantısı (yetki varsa) */
  uploadHref?: string;
}) {
  const path = `/merkez/personel/${personnelId}/evraklar`;
  const kategori = str1(searchParams.kategori);
  const ara = (str1(searchParams.ara) ?? "").trim();
  const supabase = await createClient();

  const [{ data: docRows }, { data: catRows }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, file_name, created_at, category_code, period_year, period_month, customer_visible, projects(name)")
      .eq("personnel_id", personnelId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("document_categories").select("code, name, scope, permission_code, is_active").order("sort_order"),
  ]);
  const docs = (docRows ?? []) as unknown as Doc[];
  const byCat = new Map<string, Doc[]>();
  for (const d of docs) byCat.set(d.category_code, [...(byCat.get(d.category_code) ?? []), d]);

  // aktif personel evrakı türleri + belgesi olan diğer türler; kullanıcının yetkisi olmayan tür gösterilmez
  const manage = hasPermission(user, "documents.manage");
  const categories = ((catRows ?? []) as Category[]).filter(
    (c) => ((c.scope === "personnel" && c.is_active) || byCat.has(c.code)) && (manage || hasPermission(user, c.permission_code)),
  );
  const active = categories.some((c) => c.code === kategori) ? kategori : undefined;
  const groups = categories
    .filter((c) => !active || c.code === active)
    .map((c) => ({ cat: c, list: (byCat.get(c.code) ?? []).filter((d) => !ara || matches(d.title, ara)) }))
    // aramada yalnızca eşleşen belgesi olan gruplar
    .filter((g) => !ara || g.list.length > 0);
  const visibleCount = categories.reduce((n, c) => n + (byCat.get(c.code)?.length ?? 0), 0);

  const fields: FilterField[] = [
    {
      name: "kategori", label: "Kategori", value: active, all: "Tümü",
      options: categories.map((c) => ({ value: c.code, label: `${c.name} (${byCat.get(c.code)?.length ?? 0})` })),
    },
    { name: "ara", label: "Başlık", kind: "text", value: ara, placeholder: "Belge başlığı ara…" },
  ];

  return (
    <Card id="evraklar">
      <CardHeader
        title="Evraklar"
        description={`${visibleCount} belge`}
        action={uploadHref ? <Link href={uploadHref} className={btn("secondary", "sm")}><FilePlus2 className="size-4" aria-hidden /> Evrak ekle</Link> : undefined}
      />
      <div className="px-5 pt-5">
        <FilterBar action={path} fields={fields} />
      </div>
      {groups.length === 0 ? (
        <EmptyState title="Belge bulunamadı" description={ara ? "Aramanıza uyan belge yok." : "Bu personel için görüntüleyebileceğiniz evrak türü yok."} />
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {groups.map(({ cat, list }) => (
            <details key={cat.code} open={list.length > 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-2">
                <span className="font-medium">{cat.name}</span>
                <span className="flex items-center gap-3 text-sm text-muted">
                  {list.length} belge
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                </span>
              </summary>
              <div className="border-t border-border bg-surface-2/40 px-5 py-2">
                {list.length === 0 ? (
                  <p className="py-2 text-sm text-muted">Bu türde yüklenmiş belge yok.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {list.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block font-medium">{d.title}</span>
                          <span className="block text-xs text-muted">
                            {[d.file_name, d.projects?.name, d.period_year ? formatPeriod(d.period_year, d.period_month) : null, formatDate(d.created_at), d.customer_visible ? null : "Müşteriye gizli"]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <DownloadLink id={d.id} title={d.title} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}
