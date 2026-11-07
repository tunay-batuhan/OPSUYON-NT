import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Printer } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, btn, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { PATROL_LINES } from "./lines";
import { requireStaff } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { removePatrolPoint, resetPatrolPointLocation, setPatrolPointActive } from "@/app/actions/patrol";
import { mapsUrl } from "@/lib/patrol";

export const metadata: Metadata = { title: "Devriye Noktaları" };

type Point = { id: string; project_id: string; name: string; code: string; is_active: boolean; lat: number | null; lng: number | null };

const PATH = "/devriye/noktalar";
/** Durum filtresi: varsayılan "Aktif"; "Tümü" de URL'de kalsın diye boş değer yerine "tumu" kullanılır. */
const DURUM = [
  { value: "tumu", label: "Tümü" },
  { value: "aktif", label: "Aktif" },
  { value: "pasif", label: "Pasif" },
];

/** PostgREST `ilike` / `.or()` içinde anlamı olan karakterleri temizler. */
const likeTerm = (s: string) => s.replace(/[%_*,()\\"]/g, "").trim();

/** Merkez: projelerin devriye noktalarını tanımlar ve barkod/QR etiketlerini yazdırır. */
export default async function PatrolPointsPage({ searchParams }: PageProps<"/devriye/noktalar">) {
  await requireStaff("patrol.manage");
  await requireModule("devriye");
  const sp = await searchParams;
  const projectId = str1(sp.proje);
  const ad = (str1(sp.ad) ?? "").trim();
  const term = likeTerm(ad);
  const durum = DURUM.find((d) => d.value === sp.durum)?.value ?? "aktif";
  const paging = pagingFrom(sp);

  const supabase = await createClient();
  const projects = (await getAccessibleProjects()).filter((p) => PATROL_LINES.includes(p.service_line));
  let q = supabase
    .from("patrol_points")
    .select("id, project_id, name, code, is_active, lat, lng", { count: "exact" })
    .order("sort_order")
    .order("name")
    .order("id")
    .range(paging.from, paging.to);
  if (isUuid(projectId)) q = q.eq("project_id", projectId);
  if (term) q = q.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
  if (durum !== "tumu") q = q.eq("is_active", durum === "aktif");
  const { data, count } = await q;
  const points = (data ?? []) as Point[];
  const total = count ?? 0;
  if (paging.page > 1 && points.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total) : 1));
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));

  const fields: FilterField[] = [
    { name: "proje", label: "Proje", value: projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) },
    { name: "ad", label: "Nokta adı", kind: "text", value: ad, placeholder: "Ad veya barkod kodu…" },
    { name: "durum", label: "Durum", value: durum, options: DURUM },
  ];
  const filtered = Boolean(term) || durum !== "aktif" || isUuid(projectId);

  return (
    <>

      <div>
        <div>
          <FilterBar action={PATH} fields={fields} />
          <Card>
            <CardHeader
              title={`${total} nokta`}
              description={isUuid(projectId) ? undefined : "Tüm etiketleri yazdırmak için bir proje seçin."}
              action={isUuid(projectId) && total > 0 ? (
                <Link href={`/devriye/noktalar/yazdir?proje=${projectId}`} className={btn("primary", "sm")}><Printer className="size-4" aria-hidden /> Tüm etiketleri yazdır</Link>
              ) : undefined}
            />
            {points.length === 0 ? (
              <EmptyState
                title={filtered ? "Filtrelere uyan devriye noktası yok" : "Henüz devriye noktası yok"}
                description={filtered ? undefined : "Yeni nokta ekle sekmesinden ilk noktayı ekleyin."}
              />
            ) : (
              <Table head={["Nokta", "Proje", "Barkod kodu", "Konum", "Durum", ""]}>
                {points.map((p) => (
                  <tr key={p.id}>
                    <td className={td + " font-medium"}>{p.name}</td>
                    <td className={td}>{nameOf.get(p.project_id) ?? "—"}</td>
                    <td className={td + " font-mono text-xs"}>{p.code}</td>
                    <td className={td + " whitespace-nowrap"}>
                      {p.lat != null && p.lng != null ? (
                        <>
                          <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline">Haritada gör</a>
                          <form action={resetPatrolPointLocation} className="ml-3 inline" title="Konum silinir; noktadaki ilk isabetli okutmadan yeniden öğrenilir">
                            <input type="hidden" name="id" value={p.id} />
                            <button className="text-sm text-muted hover:underline">Sıfırla</button>
                          </form>
                        </>
                      ) : (
                        <span className="text-sm text-muted" title="Noktadaki ilk isabetli okutmadan öğrenilir">İlk okutmada öğrenilecek</span>
                      )}
                    </td>
                    <td className={td}><Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Aktif" : "Pasif"}</Badge></td>
                    <td className={td + " whitespace-nowrap text-right"}>
                      <Link href={`/devriye/noktalar/yazdir?proje=${p.project_id}&nokta=${p.id}`} className="mr-3 text-sm font-medium text-brand hover:underline">Etiketi yazdır</Link>
                      <form action={setPatrolPointActive} className="mr-3 inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={p.is_active ? "0" : "1"} />
                        <button className="text-sm text-muted hover:underline">{p.is_active ? "Pasife al" : "Aktifleştir"}</button>
                      </form>
                      <form action={removePatrolPoint} className="inline" title="Okutma kaydı olan nokta silinmez, pasife alınır">
                        <input type="hidden" name="id" value={p.id} />
                        <button className="text-sm text-danger hover:underline">Sil</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            <Pagination path={PATH} searchParams={sp} total={total} />
          </Card>
        </div>
      </div>
    </>
  );
}
