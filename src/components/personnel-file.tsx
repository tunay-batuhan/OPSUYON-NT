import { Fragment } from "react";
import { Card, CardHeader, EmptyState, PageHeader, Table, cn, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { DownloadLink } from "@/components/doc-ui";
import { canAnywhere, getCurrentUser } from "@/lib/auth";
import { getHatOptions, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { FILE_SECTIONS, sectionCodes, type FileSection } from "@/lib/personnel-file";

type Choice = { id: string; full_name: string; title: string | null; lines: Set<string> };
type Doc = { id: string; title: string; file_name: string; created_at: string; category_code: string };

/** Hizmete göre (RLS ile görünen) aktif personel; ada göre sıralı. */
async function loadChoices(hat?: string): Promise<Choice[]> {
  const supabase = await createClient();
  let q = supabase.from("personnel_assignments").select("personnel(id, full_name, title), projects!inner(service_line)").is("end_date", null).limit(3000);
  if (hat) q = q.eq("projects.service_line", hat);
  const { data } = await q;
  const people = new Map<string, Choice>();
  for (const a of (data ?? []) as unknown as { personnel: { id: string; full_name: string; title: string | null } | null; projects: { service_line: string } | null }[]) {
    if (!a.personnel) continue;
    const c = people.get(a.personnel.id) ?? { ...a.personnel, lines: new Set<string>() };
    if (a.projects) c.lines.add(a.projects.service_line);
    people.set(c.id, c);
  }
  return [...people.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));
}

/**
 * "Personel seç → o personelin evrakları satır satır" ekranı (müşteri istedi).
 *  mode "checklist": Özlük Evrakları — evrak türleri sıralı; olmayanlar "Yüklenmemiş"
 *  mode "list":      Eğitimler — seçilen personelin o türdeki tüm belgeleri
 * Her satırda PDF indir ve Görüntüle (belge sayfanın altında açılır).
 */
export async function PersonnelFile({
  title, description, path, searchParams, lineNames, mode, category, listLabel = "Belge", emptyText,
}: {
  title: string;
  description: string;
  path: string;
  searchParams: Record<string, string | string[] | undefined>;
  lineNames: Record<string, string>;
  mode: "checklist" | "list";
  /** list modunda belge türü */
  category?: string;
  listLabel?: string;
  emptyText?: string;
}) {
  const user = await getCurrentUser();
  const hat = str1(searchParams.hat);
  const personId = str1(searchParams.personel);
  const choices = await loadChoices(hat);
  const person = isUuid(personId) ? choices.find((c) => c.id === personId) : undefined;

  const fields: FilterField[] = [
    { name: "hat", label: "Hizmet", value: hat, all: "Tümü", options: await getHatOptions() },
    { name: "personel", label: "Personel (Ad Soyad)", value: person?.id, all: "Personel seçin…", options: choices.map((c) => ({ value: c.id, label: c.full_name })) },
  ];

  let body: React.ReactNode;
  if (!person) {
    body = (
      <Card>
        <EmptyState title="Personel seçin" description={choices.length ? "Evraklarını görmek için yukarıdan Ad Soyad ile bir personel seçip Filtrele'ye basın." : "Seçtiğiniz hizmette aktif personel yok."} />
      </Card>
    );
  } else {
    const supabase = await createClient();
    const codes = mode === "checklist" ? sectionCodes(FILE_SECTIONS) : [category!];
    const [{ data: docRows }, { data: cats }] = await Promise.all([
      supabase.from("documents").select("id, title, file_name, created_at, category_code").eq("personnel_id", person.id).in("category_code", codes).order("created_at", { ascending: false }).limit(500),
      supabase.from("document_categories").select("code, permission_code").in("code", codes),
    ]);
    const docs = (docRows ?? []) as Doc[];
    const byCat = new Map<string, Doc[]>();
    for (const d of docs) byCat.set(d.category_code, [...(byCat.get(d.category_code) ?? []), d]);
    // kullanıcının yetkisi olmayan evrak türleri hiç gösterilmez
    const allowed = new Set((cats ?? []).filter((c) => !user || canAnywhere(user, c.permission_code as string)).map((c) => c.code as string));
    const sub = [person.title, [...person.lines].map((c) => lineNames[c] ?? c).join(", ")].filter(Boolean).join(" · ");

    if (mode === "list") {
      const list = byCat.get(category!) ?? [];
      body = (
        <Card>
          <CardHeader title={person.full_name} description={`${sub ? sub + " · " : ""}${list.length} ${listLabel.toLocaleLowerCase("tr")}`} />
          {list.length === 0 ? (
            <EmptyState title="Kayıt yok" description={emptyText ?? "Bu personel için yüklenmiş belge yok."} />
          ) : (
            <Table head={["Personel adı", listLabel, "Yükleme tarihi", ""]}>
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
      const leafRows = (s: FileSection) => {
        if (!s.code || !allowed.has(s.code)) return null;
        const list = byCat.get(s.code) ?? [];
        if (s.code === "ozluk" && list.length === 0) return null; // "Diğer" yalnızca belge varsa
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
          <CardHeader title={person.full_name} description={sub || undefined} />
          <Table head={["Sıra", "Evrak türü", "Personel adı", "Evrakın adı", ""]}>{rows}</Table>
        </Card>
      );
    }
  }

  return (
    <>
      <PageHeader title={title} description={description} />
      <FilterBar action={path} fields={fields} />
      {body}
    </>
  );
}
