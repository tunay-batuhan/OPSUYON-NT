import { ChevronDown } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Table, cn, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { DownloadLink, PdfIcon } from "@/components/doc-ui";
import { getHatOptions, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/format";
import { matches } from "@/lib/text";

type Person = { id: string; full_name: string; title: string | null; employee_no: string | null; hire_date: string | null; lines: Set<string>; projects: Set<string> };
type Doc = { id: string; personnel_id: string; title: string; file_name: string; created_at: string };
type Balance = { personnel_id: string; entitled_days: number; carried_days: number; used_days: number; remaining_days: number };

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/**
 * Personel listesi + hizmet filtresi + personele ait PDF belgeler.
 *  mode "flat":   örn. Savunmalar — satırda PDF indir ikonu
 *  mode "expand": Yıllık İzinler / Kıyafet / Savunma — personel adına tıklayınca altında PDF'ler açılır
 */
export async function PersonnelDocs({
  categories, title, description, path, searchParams, mode, leave = false, nameFilter = false, lineNames,
}: {
  categories: string[];
  title: string;
  description: string;
  path: string;
  searchParams: Record<string, string | string[] | undefined>;
  mode: "flat" | "expand";
  /** Yıllık izin: işe giriş, hak edilen, kullanılan, kalan sütunları */
  leave?: boolean;
  /** Hizmet filtresinin yanına "Personel adı" arama kutusu (birkaç harf yeter) */
  nameFilter?: boolean;
  lineNames: Record<string, string>;
}) {
  const hat = str1(searchParams.hat);
  const ad = nameFilter ? (str1(searchParams.ad) ?? "").trim() : "";
  const year = new Date().getFullYear();
  const supabase = await createClient();

  let aq = supabase
    .from("personnel_assignments")
    .select("personnel(id, full_name, title, employee_no, hire_date), projects!inner(name, service_line)")
    .is("end_date", null)
    .limit(2000);
  if (hat) aq = aq.eq("projects.service_line", hat);
  const { data: assigned } = await aq;

  const people = new Map<string, Person>();
  for (const a of (assigned ?? []) as unknown as { personnel: Omit<Person, "lines" | "projects"> | null; projects: { name: string; service_line: string } | null }[]) {
    if (!a.personnel) continue;
    const p = people.get(a.personnel.id) ?? { ...a.personnel, lines: new Set<string>(), projects: new Set<string>() };
    if (a.projects) { p.lines.add(a.projects.service_line); p.projects.add(a.projects.name); }
    people.set(p.id, p);
  }
  const list = [...people.values()]
    .filter((p) => !ad || matches(p.full_name, ad))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));
  const ids = list.map((p) => p.id);

  const docs = new Map<string, Doc[]>();
  const balances = new Map<string, Balance>();
  const recordDays = new Map<string, number>();
  await Promise.all(
    chunk(ids, 100).flatMap((part) => [
      supabase.from("documents").select("id, personnel_id, title, file_name, created_at").in("category_code", categories).in("personnel_id", part).order("created_at", { ascending: false })
        .then(({ data }) => (data ?? []).forEach((d) => docs.set(d.personnel_id as string, [...(docs.get(d.personnel_id as string) ?? []), d as Doc]))),
      ...(leave
        ? [
            supabase.from("leave_balances").select("personnel_id, entitled_days, carried_days, used_days, remaining_days").eq("year", year).in("personnel_id", part)
              .then(({ data }) => (data ?? []).forEach((b) => balances.set(b.personnel_id as string, b as Balance))),
            supabase.from("leave_records").select("personnel_id, days").eq("leave_type", "yillik").gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`).in("personnel_id", part)
              .then(({ data }) => (data ?? []).forEach((r) => recordDays.set(r.personnel_id as string, (recordDays.get(r.personnel_id as string) ?? 0) + Number(r.days)))),
          ]
        : []),
    ]),
  );

  const fields: FilterField[] = [{ name: "hat", label: "Hizmet", value: hat, all: "Tümü", options: await getHatOptions() }];
  if (nameFilter) fields.push({ name: "ad", label: "Personel adı", kind: "text", value: ad, placeholder: "Birkaç harf yazın…" });
  const lineOf = (p: Person) => [...p.lines].map((c) => lineNames[c] ?? c).join(", ");

  const leaveNumbers = (p: Person) => {
    const b = balances.get(p.id);
    if (!b) return null;
    const used = Number(b.used_days) + (recordDays.get(p.id) ?? 0);
    return { total: Number(b.entitled_days) + Number(b.carried_days), used, left: Number(b.remaining_days) - (recordDays.get(p.id) ?? 0) };
  };

  return (
    <>
      <PageHeader title={title} description={description} />
      <FilterBar action={path} fields={fields} />

      <Card>
        <CardHeader title={`${list.length} personel`} description={mode === "expand" ? "Belgeleri görmek için personel adına tıklayın." : undefined} />
        {list.length === 0 ? (
          <EmptyState title="Personel bulunamadı" description={ad ? "Aramanıza uyan personel yok." : "Seçtiğiniz hizmet için aktif personel yok."} />
        ) : mode === "flat" ? (
          <Table head={["Personel", "Görev", "Hizmet", "Belge", ""]}>
            {list.map((p) => {
              const own = docs.get(p.id) ?? [];
              return (
                <tr key={p.id}>
                  <td className={td}>
                    <p className="font-medium">{p.full_name}</p>
                    {p.employee_no && <p className="text-xs text-muted">Sicil: {p.employee_no}</p>}
                  </td>
                  <td className={td}>{p.title ?? "—"}</td>
                  <td className={td}>{lineOf(p)}</td>
                  <td className={cn(td, "text-muted")}>{own.length ? own.map((d) => d.title).join(", ") : "Belge yüklenmemiş"}</td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>{own.map((d) => <PdfIcon key={d.id} id={d.id} title={d.title} />)}</td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <div className="divide-y divide-border">
            {list.map((p) => {
              const own = docs.get(p.id) ?? [];
              const n = leave ? leaveNumbers(p) : null;
              return (
                <details key={p.id} className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 hover:bg-surface-2 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.full_name}</span>
                      <span className="block truncate text-xs text-muted">{[p.title, lineOf(p)].filter(Boolean).join(" · ")}</span>
                    </span>
                    {leave && (
                      <>
                        <Stat label="İşe giriş" value={formatDate(p.hire_date)} />
                        <Stat label="Hak edilen" value={n ? `${formatNumber(n.total)} gün` : "—"} />
                        <Stat label="Kullanılan" value={n ? `${formatNumber(n.used)} gün` : "—"} />
                        <Stat label="Kalan" value={n ? `${formatNumber(n.left)} gün` : "—"} strong danger={Boolean(n && n.left < 0)} />
                      </>
                    )}
                    {!leave && <span className="hidden text-sm text-muted sm:col-span-4 sm:block">{own.length} belge</span>}
                    <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="border-t border-border bg-surface-2/40 px-5 py-3">
                    {leave && (
                      <dl className="mb-2 grid grid-cols-2 gap-2 text-sm sm:hidden">
                        <div><dt className="text-xs text-muted">İşe giriş</dt><dd>{formatDate(p.hire_date)}</dd></div>
                        <div><dt className="text-xs text-muted">Hak edilen</dt><dd>{n ? `${formatNumber(n.total)} gün` : "—"}</dd></div>
                        <div><dt className="text-xs text-muted">Kullanılan</dt><dd>{n ? `${formatNumber(n.used)} gün` : "—"}</dd></div>
                        <div><dt className="text-xs text-muted">Kalan</dt><dd className="font-semibold">{n ? `${formatNumber(n.left)} gün` : "—"}</dd></div>
                      </dl>
                    )}
                    {own.length === 0 ? (
                      <p className="py-2 text-sm text-muted">Bu personel için yüklenmiş belge yok.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {own.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                            <span>
                              <span className="font-medium">{d.title}</span>
                              <span className="ml-2 text-xs text-muted">{d.file_name} · {formatDate(d.created_at)}</span>
                            </span>
                            <DownloadLink id={d.id} title={d.title} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <span className="hidden sm:block">
      <span className="block text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className={cn("block text-sm tabular-nums", strong && "font-semibold", danger && "text-danger")}>{value}</span>
    </span>
  );
}
