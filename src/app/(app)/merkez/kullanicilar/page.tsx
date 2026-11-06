import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, Table, td } from "@/components/ui";
import { UsersHeader } from "./tabs";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireStaff } from "@/lib/auth";
import { isUuid, str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Organization, Profile, Role } from "@/lib/types";

export const metadata: Metadata = { title: "Kullanıcılar & hesaplar" };

type Row = Profile & { organizations: { name: string } | null; roles: { name: string } | null };

const PATH = "/merkez/kullanicilar";
/** Durum filtresi: varsayılan "Aktif"; "Tümü" de URL'de kalsın diye boş değer yerine "tumu" kullanılır. */
const DURUM = [
  { value: "tumu", label: "Tümü" },
  { value: "aktif", label: "Aktif" },
  { value: "kisitli", label: "Kısıtlı" },
];
const TUR = [
  { value: "merkez", label: "Merkez" },
  { value: "musteri", label: "Müşteri" },
];

/** PostgREST `ilike` / `.or()` içinde anlamı olan karakterleri temizler. */
const likeTerm = (s: string | undefined) => (s ?? "").replace(/[%_*,()\\"]/g, "").trim();

export default async function UsersPage({ searchParams }: PageProps<"/merkez/kullanicilar">) {
  const user = await requireStaff("users.read");
  const sp = await searchParams;
  const ad = (str1(sp.ad) ?? "").trim();
  const term = likeTerm(ad);
  const tur = TUR.find((t) => t.value === sp.tur)?.value;
  const firma = isUuid(str1(sp.firma)) ? str1(sp.firma) : undefined;
  const rol = isUuid(str1(sp.rol)) ? str1(sp.rol) : undefined;
  const durum = DURUM.find((d) => d.value === sp.durum)?.value ?? "aktif";
  const paging = pagingFrom(sp);
  const supabase = await createClient();

  let q = supabase
    .from("profiles")
    .select("*, organizations(name), roles:staff_role_id(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(paging.from, paging.to);
  if (term) q = q.or(`full_name.ilike.%${term}%,username.ilike.%${term}%`);
  if (tur) q = q.eq("kind", tur === "merkez" ? "staff" : "customer");
  if (firma) q = q.eq("organization_id", firma);
  if (rol) q = q.eq("staff_role_id", rol);
  if (durum !== "tumu") q = q.eq("is_active", durum === "aktif");

  const [{ data, count }, { data: orgs }, { data: roles }] = await Promise.all([
    q,
    supabase.from("organizations").select("id, name, status").order("name"),
    supabase.from("roles").select("id, code, name, scope").order("name"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  if (paging.page > 1 && rows.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total) : 1));

  const allRoles = (roles ?? []) as Pick<Role, "id" | "code" | "name" | "scope">[];
  const allOrgs = (orgs ?? []) as Pick<Organization, "id" | "name" | "status">[];

  const fields: FilterField[] = [
    { name: "ad", label: "Ad / kullanıcı adı", kind: "text", value: ad, placeholder: "Birkaç harf yazın…" },
    { name: "tur", label: "Tür", value: tur, all: "Tümü", options: TUR },
    { name: "firma", label: "Firma", value: firma, all: "Tümü", options: allOrgs.map((o) => ({ value: o.id, label: o.name })) },
    { name: "rol", label: "Merkez rolü", value: rol, all: "Tümü", options: allRoles.filter((r) => r.scope === "staff").map((r) => ({ value: r.id, label: r.name })) },
    { name: "durum", label: "Durum", value: durum, options: DURUM },
  ];
  const filtered = Boolean(term || tur || firma || rol) || durum !== "aktif";

  return (
    <>
      <UsersHeader user={user} />
      <div>
        <div>
          <FilterBar action={PATH} fields={fields} />
          <Card>
            <CardHeader title="Mevcut hesaplar" description={`${total} kullanıcı`} />
            {rows.length === 0 ? (
              <EmptyState title={filtered ? "Filtrelere uyan kullanıcı yok" : "Kullanıcı yok"} />
            ) : (
              <Table head={["Kullanıcı", "Tür", "Firma / rol", "Son giriş", "Durum"]}>
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/merkez/kullanicilar/${u.id}`} className="font-medium hover:text-brand">{u.full_name}</Link>
                      <p className="text-xs text-muted">@{u.username}</p>
                    </td>
                    <td className={td}><Badge tone={u.kind === "staff" ? "brand" : "neutral"}>{u.kind === "staff" ? "Merkez" : "Müşteri"}</Badge></td>
                    <td className={td}>{u.kind === "staff" ? u.roles?.name : u.organizations?.name}</td>
                    <td className={td}>{formatDateTime(u.last_login_at)}</td>
                    <td className={td}><Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Aktif" : "Kısıtlı"}</Badge></td>
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
