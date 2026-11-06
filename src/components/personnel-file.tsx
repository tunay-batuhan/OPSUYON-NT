import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Table, cn, td, tdNum } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { DownloadLink } from "@/components/doc-ui";
import { Pagination } from "@/components/pagination";
import { canAnywhere, getCurrentUser } from "@/lib/auth";
import { getHatOptions, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { pageHref, pagingFrom } from "@/lib/paging";
import { fold } from "@/lib/text";
import { FILE_SECTIONS, requiredCodes, sectionCodes, type FileSection } from "@/lib/personnel-file";

type SP = Record<string, string | string[] | undefined>;
type Project = { name: string; service_line: string };
type PersonRow = {
  id: string;
  full_name: string;
  title: string | null;
  service_line?: string | null;
  personnel_assignments: { end_date: string | null; projects: Project | null }[];
};
type Doc = { id: string; title: string; file_name: string; created_at: string; category_code: string };

/**
 * Özlük Evrakları ve Eğitimler: personel listesi → personele tıklayınca detay (müşteri istedi).
 *  checklist: evrak türleri sırayla; olmayanlar "Yüklenmemiş"
 *  list:      o türdeki tüm belgeler satır satır (Eğitimler)
 */
export type FileScreen = { path: string; title: string; description: string } & (
  | { mode: "checklist" }
  | { mode: "list"; category: string; itemLabel: string }
);

export const OZLUK_SCREEN: FileScreen = {
  mode: "checklist",
  path: "/personel/ozluk",
  title: "Özlük Evrakları",
  description: "Personel adına tıklayın; evrakları sırayla açılır. Evrak sütunu yüklenen / beklenen evrak türü sayısıdır.",
};

export const EGITIM_SCREEN: FileScreen = {
  mode: "list",
  path: "/egitimler",
  title: "Eğitimler",
  description: "Personel adına tıklayın; katıldığı tüm eğitimler açılır.",
  category: "egitim",
  itemLabel: "Eğitim",
};

/** Liste filtreleri ve sayfa, detaya taşınır; "geri" bağlantısı aynı listeye döner. */
function listQuery(sp: SP): string {
  const q = new URLSearchParams();
  for (const k of ["hat", "ad", "sayfa"]) {
    const v = str1(sp[k]);
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Türkçe harf farkını yok sayan ad araması (Postgres ~*): "ozturk" → "[oöÖ]zt[uüÜ]rk". */
const TR_LETTERS: Record<string, string> = { c: "[cçÇ]", g: "[gğĞ]", i: "[iıİI]", o: "[oöÖ]", s: "[sşŞ]", u: "[uüÜ]" };
export const nameRegex = (word: string) => [...word].map((ch) => TR_LETTERS[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");

/** Kullanıcının görmeye yetkili olduğu evrak türleri (yetkisiz türler hiç gösterilmez/sayılmaz). */
export async function allowedCodes(codes: string[]): Promise<Set<string>> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data } = await supabase.from("document_categories").select("code, permission_code").in("code", codes);
  return new Set((data ?? []).filter((c) => !user || canAnywhere(user, c.permission_code as string)).map((c) => c.code as string));
}

const lineOf = (code: string | null | undefined, lineNames: Record<string, string>) => (code ? lineNames[code] ?? code : undefined);

/* ------------------------------------------------------------------ */
/* Liste: Hizmet + Ad soyad filtresi, aktif personel, 10'ar kayıt       */
/* ------------------------------------------------------------------ */
export async function PersonnelFileList({
  screen, searchParams, lineNames, headless = false,
}: {
  screen: FileScreen;
  searchParams: SP;
  lineNames: Record<string, string>;
  /** Başlığı sayfanın layout.tsx dosyası çiziyor (sekmeli bölüm): bileşen başlık çizmez. */
  headless?: boolean;
}) {
  const { path } = screen;
  // Eski adres (?personel=ID, açılır kutu dönemi) detay sayfasına gider
  const old = str1(searchParams.personel);
  if (isUuid(old)) redirect(`${path}/${old}${listQuery({ hat: searchParams.hat })}`);

  const hat = str1(searchParams.hat);
  const ad = (str1(searchParams.ad) ?? "").trim();
  const paging = pagingFrom(searchParams);
  const supabase = await createClient();

  // Bir personelin aynı anda tek aktif ataması olur (veritabanı kuralı); RLS yalnızca görülebilenleri döndürür.
  let q = supabase
    .from("personnel")
    .select("id, full_name, title, personnel_assignments!inner(end_date, projects!inner(name, service_line))", { count: "exact" })
    .is("personnel_assignments.end_date", null);
  if (hat) q = q.eq("personnel_assignments.projects.service_line", hat);
  for (const w of fold(ad).split(" ").filter(Boolean).slice(0, 5)) q = q.filter("full_name", "imatch", nameRegex(w));
  const { data, count } = await q.order("full_name").order("id").range(paging.from, paging.to);
  const people = (data ?? []) as unknown as PersonRow[];
  if (people.length === 0 && paging.page > 1) redirect(pageHref(path, searchParams, 1));
  const total = count ?? people.length;
  const ids = people.map((p) => p.id);

  // Evrak / eğitim sayısı (yalnızca bu sayfadaki personel için)
  let expected = 0;
  const cell = new Map<string, number>();
  if (ids.length) {
    if (screen.mode === "checklist") {
      const allowed = await allowedCodes(requiredCodes(FILE_SECTIONS));
      expected = allowed.size;
      if (expected) {
        const { data: docs } = await supabase.from("documents").select("personnel_id, category_code").in("personnel_id", ids).in("category_code", [...allowed]).limit(1000);
        const kinds = new Map<string, Set<string>>();
        for (const d of docs ?? []) kinds.set(d.personnel_id as string, (kinds.get(d.personnel_id as string) ?? new Set()).add(d.category_code as string));
        for (const [id, set] of kinds) cell.set(id, set.size);
      }
    } else {
      await Promise.all(
        ids.map((id) =>
          supabase.from("documents").select("id", { count: "exact", head: true }).eq("personnel_id", id).eq("category_code", screen.category)
            .then(({ count: n }) => cell.set(id, n ?? 0)),
        ),
      );
    }
  }

  const fields: FilterField[] = [
    { name: "hat", label: "Hizmet", value: hat, all: "Tümü", options: await getHatOptions() },
    { name: "ad", label: "Ad soyad", kind: "text", value: ad, placeholder: "Birkaç harf yazın…" },
  ];
  const back = listQuery(searchParams);
  const countHead = screen.mode === "checklist" ? "Evrak" : screen.itemLabel;

  return (
    <>
      {!headless && <PageHeader title={screen.title} description={screen.description} />}
      <FilterBar action={path} fields={fields} />
      <Card>
        <CardHeader title={`${total} personel`} description={screen.mode === "checklist" ? "Evrakları görmek için personele tıklayın." : "Eğitimleri görmek için personele tıklayın."} />
        {people.length === 0 ? (
          <EmptyState title="Personel bulunamadı" description={ad ? "Aramanıza uyan personel yok." : hat ? "Seçtiğiniz hizmette aktif personel yok." : "Aktif personel yok."} />
        ) : (
          <>
            <Table head={["Ad soyad", "Görev", "Hizmet", "Proje", countHead, ""]} numeric={[4]}>
              {people.map((p) => {
                const project = p.personnel_assignments[0]?.projects;
                const href = `${path}/${p.id}${back}`;
                const n = cell.get(p.id) ?? 0;
                return (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <td className={cn(td, "font-medium")}>
                      <Link href={href} className="hover:text-brand">{p.full_name}</Link>
                    </td>
                    <td className={td}>{p.title ?? "—"}</td>
                    <td className={td}>{lineOf(project?.service_line, lineNames) ?? "—"}</td>
                    <td className={td}>{project?.name ?? "—"}</td>
                    {screen.mode === "checklist" ? (
                      <td className={cn(tdNum, "whitespace-nowrap", expected > 0 && n >= expected && "font-semibold text-success", n === 0 && "text-muted")}>
                        {expected > 0 ? `${n} / ${expected}` : "—"}
                      </td>
                    ) : (
                      <td className={cn(tdNum, n === 0 && "text-muted")}>{n}</td>
                    )}
                    <td className={cn(td, "text-right")}>
                      <Link href={href} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-brand hover:underline">
                        Detay <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pagination path={path} searchParams={searchParams} total={total} />
          </>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detay: seçilen personelin evrakları / eğitimleri (PDF indir + Görüntüle) */
/* ------------------------------------------------------------------ */
export async function PersonnelFileDetail({ screen, id, searchParams, lineNames }: { screen: FileScreen; id: string; searchParams: SP; lineNames: Record<string, string> }) {
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("personnel")
    .select("id, full_name, title, service_line, personnel_assignments(end_date, projects(name, service_line))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound(); // RLS ile görünmeyen personel
  const person = data as unknown as PersonRow;
  const project = person.personnel_assignments.find((a) => !a.end_date && a.projects)?.projects;
  const sub = [person.title, lineOf(project?.service_line ?? person.service_line, lineNames), project?.name].filter(Boolean).join(" · ");

  const codes = screen.mode === "checklist" ? sectionCodes(FILE_SECTIONS) : [screen.category];
  const [{ data: docRows }, allowed] = await Promise.all([
    supabase.from("documents").select("id, title, file_name, created_at, category_code").eq("personnel_id", person.id).in("category_code", codes).order("created_at", { ascending: false }).limit(500),
    screen.mode === "checklist" ? allowedCodes(codes) : Promise.resolve(null),
  ]);
  const byCat = new Map<string, Doc[]>();
  for (const d of (docRows ?? []) as Doc[]) byCat.set(d.category_code, [...(byCat.get(d.category_code) ?? []), d]);

  let body: ReactNode;
  if (screen.mode === "list") {
    const list = byCat.get(screen.category) ?? [];
    body = (
      <Card>
        <CardHeader title={screen.title} description={`${list.length} ${screen.itemLabel.toLocaleLowerCase("tr")} belgesi · PDF indirebilir veya Görüntüle ile altta açabilirsiniz.`} />
        {list.length === 0 ? (
          <EmptyState title="Kayıt yok" description={`Bu personel için yüklenmiş ${screen.itemLabel.toLocaleLowerCase("tr")} belgesi yok.`} />
        ) : (
          <Table head={["Personel adı", screen.itemLabel, "Yükleme tarihi", ""]}>
            {list.map((d) => (
              <tr key={d.id}>
                <td className={cn(td, "font-medium")}>{person.full_name}</td>
                <td className={td}>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted">{d.file_name}</p>
                </td>
                <td className={td}>{formatDate(d.created_at)}</td>
                <td className={cn(td, "whitespace-nowrap text-right")}><DownloadLink id={d.id} title={d.title} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    );
  } else {
    const ok = allowed ?? new Set<string>();
    const required = requiredCodes(FILE_SECTIONS).filter((c) => ok.has(c));
    const done = required.filter((c) => byCat.has(c)).length;

    const leafRows = (s: FileSection) => {
      if (!s.code || !ok.has(s.code)) return null;
      const list = byCat.get(s.code) ?? [];
      if (s.optional && list.length === 0) return null; // "Diğer" yalnızca belge varsa
      if (list.length === 0) {
        return (
          <tr key={s.no}>
            <td className={cn(td, "w-14 text-muted")}>{s.no}</td>
            <td className={cn(td, "font-medium")}>{s.label}</td>
            <td className={td}>{person.full_name}</td>
            <td className={cn(td, "italic text-muted")}>Yüklenmemiş</td>
            <td className={td} />
          </tr>
        );
      }
      return list.map((d, i) => (
        <tr key={d.id}>
          <td className={cn(td, "w-14 text-muted")}>{i === 0 ? s.no : ""}</td>
          <td className={cn(td, "font-medium")}>{i === 0 ? s.label : ""}</td>
          <td className={td}>{person.full_name}</td>
          <td className={td}>
            <p className="font-medium">{d.title}</p>
            <p className="text-xs text-muted">{d.file_name} · {formatDate(d.created_at)}</p>
          </td>
          <td className={cn(td, "whitespace-nowrap text-right")}><DownloadLink id={d.id} title={d.title} /></td>
        </tr>
      ));
    };
    const rows = FILE_SECTIONS.map((s) => {
      if (s.children) {
        const kids = s.children.map(leafRows).filter(Boolean);
        if (kids.length === 0) return null;
        return (
          <Fragment key={s.no}>
            <tr className="bg-surface-2/60">
              <td className={cn(td, "w-14 font-semibold text-muted")}>{s.no}</td>
              <td colSpan={4} className={cn(td, "font-semibold")}>{s.label}</td>
            </tr>
            {kids}
          </Fragment>
        );
      }
      return <Fragment key={s.no}>{leafRows(s)}</Fragment>;
    });
    body = (
      <Card>
        <CardHeader title={screen.title} description={`${done} / ${required.length} evrak türü yüklü · PDF indirebilir veya Görüntüle ile altta açabilirsiniz.`} />
        {ok.size === 0 ? (
          <EmptyState title="Görüntülenecek evrak türü yok" description="Hesabınızın özlük evraklarını görme yetkisi yok." />
        ) : (
          <Table head={["Sıra", "Evrak türü", "Personel adı", "Evrakın adı", ""]}>{rows}</Table>
        )}
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`${screen.path}${listQuery(searchParams)}`} className="inline-flex items-center gap-1 hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> {screen.title}
          </Link>
        }
        title={person.full_name}
        description={sub || undefined}
      />
      {body}
    </>
  );
}
