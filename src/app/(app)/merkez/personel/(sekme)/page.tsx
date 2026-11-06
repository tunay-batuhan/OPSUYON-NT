import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, Table, btn, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { hasPermission, requireStaff } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { isUuid, str1 } from "@/lib/lookups";
import { pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { Personnel } from "@/lib/types";

export const metadata: Metadata = { title: "Personel" };

const PATH = "/merkez/personel";
const tone = { active: "success", passive: "warning", terminated: "neutral" } as const;
const label = { active: "Aktif", passive: "Pasif", terminated: "Ayrıldı" } as const;

/** Durum filtresi (URL'de Türkçe anahtar). Varsayılan "aktif": pasif/ayrılan personel varsayılan listede görünmez. */
const STATUS = [
  { value: "tumu", label: "Tümü", db: null },
  { value: "aktif", label: "Aktif", db: "active" },
  { value: "pasif", label: "Pasif", db: "passive" },
  { value: "ayrildi", label: "Ayrıldı", db: "terminated" },
] as const;

type Row = Pick<Personnel, "id" | "full_name" | "title" | "service_line" | "organization_id" | "hire_date" | "status">;

/** ilike deseni: joker karakterler aranmaz. */
const like = (v: string) => `%${v.replace(/[%_\\]/g, "")}%`;

export default async function PersonnelPage({ searchParams }: PageProps<"/merkez/personel">) {
  const user = await requireStaff("personnel.read");
  const sp = await searchParams;
  const ad = (str1(sp.ad) ?? "").trim();
  const unvan = (str1(sp.unvan) ?? "").trim();
  const firma = isUuid(str1(sp.firma)) ? str1(sp.firma) : undefined;
  const hat = str1(sp.hat);
  const yil = /^\d{4}$/.test(str1(sp.yil) ?? "") ? str1(sp.yil) : undefined;
  const durum = STATUS.find((s) => s.value === sp.durum) ?? STATUS[1];
  const paging = pagingFrom(sp);
  const supabase = await createClient();

  let query = supabase
    .from("personnel")
    .select("id, full_name, title, service_line, organization_id, hire_date, status", { count: "exact" });
  if (ad) query = query.ilike("full_name", like(ad));
  if (unvan) query = query.ilike("title", like(unvan));
  if (firma) query = query.eq("organization_id", firma);
  if (hat) query = query.eq("service_line", hat);
  if (yil) query = query.gte("hire_date", `${yil}-01-01`).lte("hire_date", `${yil}-12-31`);
  if (durum.db) query = query.eq("status", durum.db);

  const [{ data, count }, lines, { data: orgRows }, { data: oldest }] = await Promise.all([
    query.order("full_name").order("id").range(paging.from, paging.to),
    getServiceLines(),
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("personnel").select("hire_date").not("hire_date", "is", null).order("hire_date").limit(1).maybeSingle(),
  ]);
  const list = (data ?? []) as Row[];
  // filtre değişince sayfa numarası boşa düşerse ilk sayfaya dön
  if (paging.page > 1 && list.length === 0) redirect(pageHref(PATH, sp, 1));

  const orgs = (orgRows ?? []) as { id: string; name: string }[];
  const total = count ?? 0;
  const manage = hasPermission(user, "personnel.manage");

  const thisYear = new Date().getFullYear();
  const firstYear = Math.max(1970, Math.min(thisYear, Number(String(oldest?.hire_date ?? thisYear).slice(0, 4)) || thisYear));
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => String(thisYear - i)).map((y) => ({ value: y, label: y }));

  // filtreler tablodaki sütunlarla aynı sırada
  const fields: FilterField[] = [
    { name: "ad", label: "Ad soyad", kind: "text", value: ad, placeholder: "Birkaç harf yazın…" },
    { name: "firma", label: "Çalıştığı firma", value: firma, all: "Tümü", options: orgs.map((o) => ({ value: o.id, label: o.name })) },
    { name: "unvan", label: "Ünvan", kind: "text", value: unvan, placeholder: "Örn. güvenlik" },
    { name: "hat", label: "Hizmet alanı", value: hat, all: "Tümü", options: lines.map((l) => ({ value: l.code, label: l.name })) },
    { name: "yil", label: "İşe giriş yılı", value: yil, all: "Tümü", options: years },
    { name: "durum", label: "Durum", value: durum.value, options: STATUS.map((s) => ({ value: s.value, label: s.label })) },
  ];

  return (
    <>
      <FilterBar action={PATH} fields={fields} />
      <Card>
        <CardHeader title={`${total} personel`} description={durum.db ? `Durum: ${durum.label}` : undefined} />
        {list.length === 0 ? (
          <EmptyState
            title="Personel bulunamadı"
            description={durum.value === "aktif" ? "Pasif veya ayrılan personeli görmek için Durum filtresini değiştirin." : "Filtreleri değiştirip tekrar deneyin."}
            action={manage ? <Link href="/merkez/personel/ekle" className={btn("primary", "sm")}>Personel ekle</Link> : undefined}
          />
        ) : (
          <Table head={["Ad soyad", "Çalıştığı firma", "Ünvan", "Hizmet alanı", "İşe giriş", "Durum"]}>
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className={td}><Link href={`/merkez/personel/${p.id}`} className="font-medium hover:text-brand">{p.full_name}</Link></td>
                <td className={td}>{orgs.find((o) => o.id === p.organization_id)?.name ?? "—"}</td>
                <td className={td}>{p.title ?? "—"}</td>
                <td className={td}>{lines.find((l) => l.code === p.service_line)?.name ?? "—"}</td>
                <td className={td}>{formatDate(p.hire_date)}</td>
                <td className={td}><Badge tone={tone[p.status]}>{label[p.status]}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination path={PATH} searchParams={sp} total={total} />
      </Card>
    </>
  );
}
