import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, Table, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { hasPermission, requireStaff } from "@/lib/auth";
import { str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { setOrganizationStatus } from "@/app/actions/projects";
import type { Organization } from "@/lib/types";

export const metadata: Metadata = { title: "Firmalar" };

const PATH = "/merkez/firmalar";
const tone = { active: "success", suspended: "warning", archived: "neutral" } as const;
const label = { active: "Aktif", suspended: "Askıda", archived: "Arşiv" } as const;

/** Durum filtresi: varsayılan "Aktif"; "Tümü" de URL'de kalsın diye boş değer yerine "tumu" kullanılır. */
const DURUM = [
  { value: "tumu", label: "Tümü" },
  { value: "aktif", label: "Aktif" },
  { value: "askida", label: "Askıda" },
  { value: "arsiv", label: "Arşiv" },
];
const statusOf: Record<string, Organization["status"]> = { aktif: "active", askida: "suspended", arsiv: "archived" };

/** PostgREST `ilike` / `.or()` içinde anlamı olan karakterleri temizler. */
const likeTerm = (s: string | undefined) => (s ?? "").replace(/[%_*,()\\"]/g, "").trim();

export default async function OrganizationsPage({ searchParams }: PageProps<"/merkez/firmalar">) {
  const user = await requireStaff("organizations.read");
  const sp = await searchParams;
  const ad = (str1(sp.ad) ?? "").trim();
  const term = likeTerm(ad);
  const durum = DURUM.find((d) => d.value === sp.durum)?.value ?? "aktif";
  const paging = pagingFrom(sp);
  const supabase = await createClient();

  let q = supabase.from("organizations").select("*", { count: "exact" }).order("name").order("id").range(paging.from, paging.to);
  if (durum !== "tumu") q = q.eq("status", statusOf[durum]);
  if (term) q = q.or(`name.ilike.%${term}%,legal_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data, count } = await q;
  const orgs = (data ?? []) as Organization[];
  const total = count ?? 0;
  // Silme/durum değişikliği sonrası boş kalan sayfadan son sayfaya dön
  if (paging.page > 1 && orgs.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total) : 1));

  // Proje ve hesap sayıları yalnızca bu sayfadaki firmalar için sayılır
  const ids = orgs.map((o) => o.id);
  const [{ data: userRows }, { data: projectRows }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("organization_id").eq("kind", "customer").in("organization_id", ids),
        supabase.from("projects").select("organization_id").in("organization_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const countBy = (rows: { organization_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => r.organization_id && m.set(r.organization_id, (m.get(r.organization_id) ?? 0) + 1));
    return m;
  };
  const userCount = countBy(userRows);
  const projectCount = countBy(projectRows);
  const manage = hasPermission(user, "organizations.manage");

  const fields: FilterField[] = [
    { name: "ad", label: "Firma adı", kind: "text", value: ad, placeholder: "Ad, ünvan, e-posta, telefon…" },
    { name: "durum", label: "Durum", value: durum, options: DURUM },
  ];
  const filtered = Boolean(term) || durum !== "aktif";

  return (
    <>
      <div>
        <div>
          <FilterBar action={PATH} fields={fields} />
          <Card>
            <CardHeader title={`${total} firma`} description={durum === "aktif" ? "Askıdaki ve arşivlenen firmalar için Durum filtresini değiştirin." : undefined} />
            {orgs.length === 0 ? (
              <EmptyState title={filtered ? "Filtrelere uyan firma yok" : "Henüz firma yok"} />
            ) : (
              <Table head={["Firma", "Projeler", "Hesaplar", "İletişim", "Durum", manage ? "İşlemler" : null].filter((h) => h !== null)}>
                {orgs.map((o) => (
                  <tr key={o.id}>
                    <td className={td}>
                      <Link href={`/merkez/firmalar/${o.id}`} className="font-medium hover:text-brand">{o.name}</Link>
                      {o.legal_name && <p className="text-xs text-muted">{o.legal_name}</p>}
                    </td>
                    <td className={td}>{projectCount.get(o.id) ?? 0}</td>
                    <td className={td}>{userCount.get(o.id) ?? 0}</td>
                    <td className={td}>
                      {o.email ?? "—"}
                      {o.phone && <p className="text-xs text-muted">{o.phone}</p>}
                    </td>
                    <td className={td}><Badge tone={tone[o.status]}>{label[o.status]}</Badge></td>
                    {manage && (
                      <td className={td}>
                        <div className="mb-1 flex gap-3 text-sm">
                          <Link href={`/merkez/firmalar/${o.id}`} className="font-medium text-brand hover:underline">Düzenle</Link>
                          <Link href={`/merkez/projeler/ekle?firma=${o.id}`} className="font-medium text-brand hover:underline">+ Proje</Link>
                          <Link href={`/merkez/kullanicilar/musteri-ekle?firma=${o.id}`} className="font-medium text-brand hover:underline">+ Hesap aç</Link>
                        </div>
                        <form action={setOrganizationStatus} className="flex gap-2">
                          <input type="hidden" name="id" value={o.id} />
                          {o.status !== "active" && <button name="status" value="active" className="text-sm text-brand hover:underline">Aktifleştir</button>}
                          {o.status === "active" && <button name="status" value="suspended" className="text-sm text-warning hover:underline">Askıya al</button>}
                          {o.status !== "archived" && <button name="status" value="archived" className="text-sm text-muted hover:underline">Arşivle</button>}
                        </form>
                      </td>
                    )}
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
