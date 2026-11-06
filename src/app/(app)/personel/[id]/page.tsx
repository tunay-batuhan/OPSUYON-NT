import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { Card, CardHeader, PageHeader, Table, cn, td, tdNum } from "@/components/ui";
import { DownloadLink } from "@/components/doc-ui";
import { allowedCodes } from "@/components/personnel-file";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { getLineNames } from "@/lib/lines";
import { isUuid } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_TYPE_LABELS, formatDate, formatNumber } from "@/lib/format";
import { leaveDeducts, tenureLabel } from "@/lib/leave-law";
import { FILE_SECTIONS, requiredCodes, sectionCodes, type FileSection } from "@/lib/personnel-file";
import { personnelListQuery } from "../list-query";

export const metadata: Metadata = { title: "Personel" };

type Person = {
  id: string;
  full_name: string;
  title: string | null;
  hire_date: string | null;
  personnel_assignments: { position: string | null; start_date: string; end_date: string | null; projects: { name: string; service_line: string } | null }[];
};
type Doc = { id: string; title: string; file_name: string; created_at: string; category_code: string };
type Balance = { entitled_days: number; carried_days: number; used_days: number; remaining_days: number };
type LeaveRecord = { id: string; leave_type: string; start_date: string; end_date: string | null; days: number };

const flatSections = (s: FileSection[]): FileSection[] => s.flatMap((x) => [...(x.code ? [x] : []), ...flatSections(x.children ?? [])]);

/**
 * Müşteri: bir personelin her şeyi tek sayfada — özlük evrak durumu, yıllık izin, eğitimler,
 * kıyafet ve ekipman, savunma ve ihtarlar. Her bölüm yalnızca modülü açıksa ve hesap yetkiliyse görünür.
 * Doğum tarihi, adres, telefon gibi kişisel bilgiler müşteriye gösterilmez.
 */
export default async function PersonnelDetailPage({ params, searchParams }: PageProps<"/personel/[id]">) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (user.kind === "staff") redirect(isUuid(id) ? `/merkez/personel/${id}` : "/merkez/personel");
  if (!isUuid(id) || !canAnywhere(user, "personnel.read")) notFound();

  const supabase = await createClient();
  const [{ data }, on, lineNames] = await Promise.all([
    supabase
      .from("personnel")
      .select("id, full_name, title, hire_date, personnel_assignments(position, start_date, end_date, projects(name, service_line))")
      .eq("id", id)
      .maybeSingle(),
    getEnabledModules(),
    getLineNames(),
  ]);
  if (!data) notFound(); // RLS ile görünmeyen personel
  const person = data as unknown as Person;
  const active = person.personnel_assignments.find((a) => !a.end_date && a.projects);
  const lastAssignment = active ?? [...person.personnel_assignments].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const project = lastAssignment?.projects ?? null;
  const line = project ? lineNames[project.service_line] ?? project.service_line : null;

  const can = (perm: string) => canAnywhere(user, perm);
  const show = {
    ozluk: on.has("personel_ozluk") && (can("personnel.files.read") || can("contracts.read")),
    izin: on.has("personel_izin") && can("leaves.read"),
    egitim: on.has("personel_egitim") && can("trainings.read"),
    kiyafet: on.has("personel_kiyafet") && can("uniform.read"),
    savunma: on.has("personel_savunma") && can("defenses.read"),
  };
  const codes = [
    ...(show.ozluk ? sectionCodes(FILE_SECTIONS) : []),
    ...(show.izin ? ["yillik_izin"] : []),
    ...(show.egitim ? ["egitim"] : []),
    ...(show.kiyafet ? ["kiyafet_ekipman"] : []),
    ...(show.savunma ? ["savunma", "ihtar"] : []),
  ];
  const year = new Date().getFullYear();
  const [docsRes, ozlukAllowed, balRes, recRes] = await Promise.all([
    codes.length
      ? supabase.from("documents").select("id, title, file_name, created_at, category_code").eq("personnel_id", id).in("category_code", codes).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [] }),
    show.ozluk ? allowedCodes(requiredCodes(FILE_SECTIONS)) : Promise.resolve(new Set<string>()),
    show.izin
      ? supabase.from("leave_balances").select("entitled_days, carried_days, used_days, remaining_days").eq("personnel_id", id).eq("year", year).maybeSingle()
      : Promise.resolve({ data: null }),
    show.izin
      ? supabase.from("leave_records").select("id, leave_type, start_date, end_date, days").eq("personnel_id", id).gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`).order("start_date", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const docs = (docsRes.data ?? []) as Doc[];
  const byCat = (...cats: string[]) => docs.filter((d) => cats.includes(d.category_code));

  const back = personnelListQuery(sp);
  const facts: [string, ReactNode][] = [
    ["Görev", lastAssignment?.position ?? person.title ?? "—"],
    ["Hizmet", line ?? "—"],
    ["Proje", project?.name ?? "—"],
    ["Durum", active ? "Aktif" : "Ayrıldı"],
    ["İşe giriş", formatDate(person.hire_date)],
    ["Çalışma süresi", tenureLabel(person.hire_date) ?? "—"],
  ];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/personel${back}`} className="inline-flex items-center gap-1 hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> Personel
          </Link>
        }
        title={person.full_name}
        description={[lastAssignment?.position ?? person.title, line, project?.name].filter(Boolean).join(" · ") || undefined}
      />

      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
              <dd className={cn("mt-0.5 truncate text-sm font-medium", k === "Durum" && (active ? "text-success" : "text-muted"))}>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {show.ozluk && <OzlukCard id={id} docs={docs} allowed={ozlukAllowed} />}
        {show.izin && <LeaveCard balance={balRes.data as Balance | null} records={(recRes.data ?? []) as LeaveRecord[]} docs={byCat("yillik_izin")} year={year} />}
        {show.egitim && (
          <DocCard
            title="Eğitimler"
            docs={byCat("egitim")}
            empty="Bu personel için yüklenmiş eğitim belgesi yok."
            more={{ href: `/egitimler/${id}`, label: "Eğitim sayfası" }}
          />
        )}
        {show.kiyafet && <DocCard title="Kıyafet ve Ekipman" docs={byCat("kiyafet_ekipman")} empty="Kıyafet ve ekipman teslim tutanağı yüklenmemiş." />}
        {show.savunma && <DocCard title="Savunmalar ve İhtarlar" docs={byCat("savunma", "ihtar")} empty="Savunma tutanağı veya ihtar yok." />}
      </div>
    </>
  );
}

/** Özlük: hangi evrak türleri yüklü, hangileri eksik; ayrıntı için Özlük Evrakları sayfası. */
function OzlukCard({ id, docs, allowed }: { id: string; docs: Doc[]; allowed: Set<string> }) {
  const have = new Set(docs.map((d) => d.category_code));
  const items = flatSections(FILE_SECTIONS).filter((s) => s.code && !s.optional && allowed.has(s.code));
  const done = items.filter((s) => have.has(s.code!)).length;
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Özlük Evrakları"
        description={items.length ? `${done} / ${items.length} evrak türü yüklü` : "Hesabınızın özlük evraklarını görme yetkisi yok."}
        action={items.length ? <MoreLink href={`/personel/ozluk/${id}`} label="Evrakları aç" /> : undefined}
      />
      {items.length > 0 && (
        <ul className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => {
            const ok = have.has(s.code!);
            return (
              <li key={s.code} className="flex items-center gap-2 text-sm">
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-success-soft text-success" : "bg-surface-2 text-muted")}>
                  {ok ? <Check className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                </span>
                <span className={cn(!ok && "text-muted")}>{s.label}</span>
                <span className="sr-only">{ok ? "yüklü" : "yüklenmemiş"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Yıllık izin: bu yılın hak edilen / kullanılan / kalan günü, izin kayıtları ve imzalı izin formları. */
function LeaveCard({ balance, records, docs, year }: { balance: Balance | null; records: LeaveRecord[]; docs: Doc[]; year: number }) {
  const deducted = records.filter((r) => leaveDeducts(r.leave_type)).reduce((s, r) => s + Number(r.days), 0);
  const n = balance
    ? { total: Number(balance.entitled_days) + Number(balance.carried_days), used: Number(balance.used_days) + deducted, left: Number(balance.remaining_days) - deducted }
    : null;
  return (
    <Card>
      <CardHeader title={`Yıllık İzin ${year}`} description={n ? "Yalnızca yıllık izin bakiyeden düşer; babalık, evlilik gibi yasal izinler düşmez." : "Bu yıl için izin bakiyesi henüz girilmemiş."} />
      {n && (
        <dl className="grid grid-cols-3 gap-4 border-b border-border px-5 py-4">
          <Stat label="Hak edilen" value={`${formatNumber(n.total)} gün`} />
          <Stat label="Kullanılan" value={`${formatNumber(n.used)} gün`} />
          <Stat label="Kalan" value={`${formatNumber(n.left)} gün`} strong danger={n.left < 0} />
        </dl>
      )}
      {records.length > 0 && (
        <Table head={["İzin türü", "Tarih", "Gün"]} numeric={[2]}>
          {records.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                {LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type}
                {!leaveDeducts(r.leave_type) && <p className="text-xs text-muted">Yıllık izinden düşmez</p>}
              </td>
              <td className={cn(td, "whitespace-nowrap")}>{formatDate(r.start_date)}{r.end_date && r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ""}</td>
              <td className={tdNum}>{formatNumber(r.days)}</td>
            </tr>
          ))}
        </Table>
      )}
      <DocList docs={docs} empty={records.length || n ? "İmzalı izin formu yüklenmemiş." : "İzin kaydı ve izin formu yok."} heading={docs.length ? "İzin formları" : undefined} />
    </Card>
  );
}

function DocCard({ title, docs, empty, more }: { title: string; docs: Doc[]; empty: string; more?: { href: string; label: string } }) {
  return (
    <Card>
      <CardHeader title={title} description={docs.length ? `${docs.length} belge` : undefined} action={more && docs.length > 0 ? <MoreLink {...more} /> : undefined} />
      <DocList docs={docs} empty={empty} />
    </Card>
  );
}

function DocList({ docs, empty, heading }: { docs: Doc[]; empty: string; heading?: string }) {
  if (docs.length === 0) return <p className="px-5 py-5 text-sm text-muted">{empty}</p>;
  return (
    <div className="px-5 py-2">
      {heading && <p className="pt-2 text-[11px] uppercase tracking-wide text-muted">{heading}</p>}
      <ul className="divide-y divide-border">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block font-medium">{d.title}</span>
              <span className="block text-xs text-muted">{formatDate(d.created_at)}</span>
            </span>
            <DownloadLink id={d.id} title={d.title} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-brand hover:underline">
      {label} <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

function Stat({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-sm tabular-nums", strong && "font-semibold", danger && "text-danger")}>{value}</dd>
    </div>
  );
}
