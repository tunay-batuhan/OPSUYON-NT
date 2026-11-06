import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader, EmptyState, Table, cn, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { nameRegex } from "@/components/personnel-file";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { getAccessibleProjects, getHatOptions, isUuid, str1 } from "@/lib/lookups";
import { getLineNames } from "@/lib/lines";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { tenureLabel } from "@/lib/leave-law";
import { pageHref, pagingFrom } from "@/lib/paging";
import { fold } from "@/lib/text";
import { personnelListQuery } from "../list-query";

export const metadata: Metadata = { title: "Personel" };

type Row = {
  id: string;
  full_name: string;
  title: string | null;
  hire_date: string | null;
  personnel_assignments: { position: string | null; projects: { name: string; service_line: string } | null }[];
};

/**
 * Müşteri: Personel menüsüne tıklayınca projelerindeki tüm aktif personel listelenir.
 * Kişiye tıklayınca özlük, eğitim, izin, kıyafet ve savunma bilgileri tek sayfada açılır (/personel/[id]).
 */
export default async function PersonnelListPage({ searchParams }: PageProps<"/personel">) {
  const user = await requireUser();
  if (user.kind === "staff") redirect("/merkez/personel");
  const sp = await searchParams;
  const hat = str1(sp.hat);
  if (!canAnywhere(user, "personnel.read")) {
    // Personel listesini görme yetkisi yoksa açık olan ilk alt ekrana git (hizmet filtresi korunur)
    const on = await getEnabledModules();
    const first = (
      [["personel_ozluk", "/personel/ozluk"], ["personel_izin", "/personel/izinler"], ["personel_kiyafet", "/personel/kiyafet"]] as const
    ).find(([m]) => on.has(m));
    if (first) redirect(hat ? `${first[1]}?hat=${encodeURIComponent(hat)}` : first[1]);
    notFound();
  }
  const proje = str1(sp.proje);
  const ad = (str1(sp.ad) ?? "").trim();
  const paging = pagingFrom(sp);
  const [projects, lineNames, hatOptions, supabase] = await Promise.all([getAccessibleProjects(), getLineNames(), getHatOptions(), createClient()]);

  // Bir personelin aynı anda tek aktif ataması olur (veritabanı kuralı); RLS yalnızca müşterinin projelerindekileri döndürür.
  let q = supabase
    .from("personnel")
    .select("id, full_name, title, hire_date, personnel_assignments!inner(position, end_date, project_id, projects!inner(name, service_line))", { count: "exact" })
    .is("personnel_assignments.end_date", null);
  if (hat) q = q.eq("personnel_assignments.projects.service_line", hat);
  if (isUuid(proje)) q = q.eq("personnel_assignments.project_id", proje);
  for (const w of fold(ad).split(" ").filter(Boolean).slice(0, 5)) q = q.filter("full_name", "imatch", nameRegex(w));
  const { data, count } = await q.order("full_name").order("id").range(paging.from, paging.to);
  const people = (data ?? []) as unknown as Row[];
  if (people.length === 0 && paging.page > 1) redirect(pageHref("/personel", sp, 1));
  const total = count ?? people.length;

  const fields: FilterField[] = [{ name: "hat", label: "Hizmet", value: hat, all: "Tümü", options: hatOptions }];
  if (projects.length > 1) fields.push({ name: "proje", label: "Proje", value: proje, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) });
  fields.push({ name: "ad", label: "Ad soyad", kind: "text", value: ad, placeholder: "Birkaç harf yazın…" });
  const back = personnelListQuery(sp);

  return (
    <>
      <FilterBar action="/personel" fields={fields} />
      <Card>
        <CardHeader title={`${total} personel`} description="Ayrıntılar için personele tıklayın." />
        {people.length === 0 ? (
          <EmptyState title="Personel bulunamadı" description={ad ? "Aramanıza uyan personel yok." : hat || proje ? "Seçiminize uyan aktif personel yok." : "Projelerinizde aktif personel yok."} />
        ) : (
          <>
            <Table head={["Ad soyad", "Görev", "Hizmet", "Proje", "İşe giriş", ""]}>
              {people.map((p) => {
                const a = p.personnel_assignments[0];
                const href = `/personel/${p.id}${back}`;
                const tenure = tenureLabel(p.hire_date);
                return (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <td className={cn(td, "font-medium")}>
                      <Link href={href} className="hover:text-brand">{p.full_name}</Link>
                    </td>
                    <td className={td}>{a?.position ?? p.title ?? "—"}</td>
                    <td className={td}>{a?.projects ? lineNames[a.projects.service_line] ?? a.projects.service_line : "—"}</td>
                    <td className={td}>{a?.projects?.name ?? "—"}</td>
                    <td className={cn(td, "whitespace-nowrap")}>
                      {formatDate(p.hire_date)}
                      {tenure && <p className="text-xs text-muted">{tenure}</p>}
                    </td>
                    <td className={cn(td, "text-right")}>
                      <Link href={href} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-brand hover:underline">
                        Detay <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pagination path="/personel" searchParams={sp} total={total} />
          </>
        )}
      </Card>
    </>
  );
}
