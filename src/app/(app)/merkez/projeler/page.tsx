import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, Table, td, lineColor } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireStaff } from "@/lib/auth";
import { getAllServiceLines } from "@/lib/lines";
import { isUuid, str1 } from "@/lib/lookups";
import { pagingFrom } from "@/lib/paging";
import { formatDate, isoDayFromNow } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "Projeler" };

const PATH = "/merkez/projeler";

/** URL'deki durum → veritabanı durumu ("tumu" = filtre yok; varsayılan "aktif"). */
const STATUS = { aktif: "active", duraklatildi: "paused", pasif: "closed" } as const;
const DURUM = ["tumu", "aktif", "duraklatildi", "pasif"] as const;
const statusLabel = { active: "Aktif", paused: "Duraklatıldı", closed: "Pasif" } as const;
const statusTone = { active: "success", paused: "warning", closed: "neutral" } as const;

type Row = Pick<Project, "id" | "name" | "code" | "service_line" | "status" | "end_date" | "organizations">;

export default async function ProjectsPage({ searchParams }: PageProps<"/merkez/projeler">) {
  const sp = await searchParams;
  // Firmalar sayfasındaki "+ Proje" bağlantısı (?firma=ID) ekleme sekmesine gider
  const firma = str1(sp.firma);
  if (firma) redirect(`${PATH}/ekle?firma=${encodeURIComponent(firma)}`);
  await requireStaff("projects.read");

  const musteri = str1(sp.musteri);
  const hat = str1(sp.hat); // dashboard kartları ?hat= ile gelir
  const durum = DURUM.find((d) => d === sp.durum) ?? "aktif";
  const bitis = str1(sp.bitis);
  const ad = (str1(sp.ad) ?? "").trim().slice(0, 60);
  const { from, to } = pagingFrom(sp);

  const supabase = await createClient();
  let q = supabase
    .from("projects")
    .select("id, name, code, service_line, status, end_date, organizations(id, name)", { count: "exact" });
  if (isUuid(musteri)) q = q.eq("organization_id", musteri);
  if (hat) q = q.eq("service_line", hat);
  if (durum !== "tumu") q = q.eq("status", STATUS[durum]);
  if (bitis === "yaklasan") q = q.gte("end_date", isoDayFromNow(0)).lte("end_date", isoDayFromNow(60));
  else if (bitis === "gecti") q = q.lt("end_date", isoDayFromNow(0));
  else if (bitis === "yok") q = q.is("end_date", null);
  if (ad) q = q.ilike("name", `%${ad.replace(/[%_*\\]/g, "")}%`);

  const [lines, { data: usage }, { data: orgs }, { data, count }] = await Promise.all([
    getAllServiceLines(),
    // filtre seçenekleri: projesi olan firmalar ve pasif hatlar
    supabase.from("projects").select("organization_id, service_line").limit(5000),
    supabase.from("organizations").select("id, name").order("name"),
    q.order("created_at", { ascending: false }).range(from, to),
  ]);
  const usedLines = new Set((usage ?? []).map((u) => u.service_line as string));
  const usedOrgs = new Set((usage ?? []).map((u) => u.organization_id as string));
  const lineByCode = new Map(lines.map((l) => [l.code, l]));
  const list = (data ?? []) as unknown as Row[];
  const filtered = Boolean(musteri || hat || bitis || ad) || durum !== "aktif";

  return (
    <>
      <FilterBar
        action={PATH}
        fields={[
          {
            name: "musteri", label: "Firma", value: musteri, all: "Tümü",
            options: (orgs ?? []).filter((o) => usedOrgs.has(o.id as string)).map((o) => ({ value: o.id as string, label: o.name as string })),
          },
          {
            name: "hat", label: "Hizmet alanı", value: hat, all: "Tümü",
            // aktif hatlar + projesi olan pasif hatlar (ör. eski Kurumsal Tedarik projeleri)
            options: lines
              .filter((l) => l.is_active || usedLines.has(l.code))
              .map((l) => ({ value: l.code, label: l.is_active ? l.name : `${l.name} (pasif)` })),
          },
          {
            name: "durum", label: "Durum", value: durum,
            options: [
              { value: "tumu", label: "Tümü" },
              { value: "aktif", label: "Aktif" },
              { value: "duraklatildi", label: "Duraklatıldı" },
              { value: "pasif", label: "Pasif" },
            ],
          },
          {
            name: "bitis", label: "Bitiş", value: bitis, all: "Tümü",
            options: [
              { value: "yaklasan", label: "60 gün içinde bitecek" },
              { value: "gecti", label: "Süresi dolmuş" },
              { value: "yok", label: "Bitiş tarihi yok" },
            ],
          },
          { name: "ad", label: "Proje adı", kind: "text", value: ad, placeholder: "Proje adı ara…" },
        ]}
      />
      <Card>
        {list.length === 0 ? (
          <EmptyState
            title={filtered ? "Bu filtrelere uyan proje yok" : "Aktif proje yok"}
            description={filtered ? "Filtreleri değiştirerek tekrar deneyin." : "Pasif ve duraklatılmış projeler için Durum filtresinde “Tümü”nü seçin."}
          />
        ) : (
          <Table head={["Proje", "Firma", "Hizmet alanı", "Bitiş", "Durum"]}>
            {list.map((p) => {
              const line = lineByCode.get(p.service_line);
              return (
                <tr key={p.id} className="hover:bg-surface-2">
                  <td className={td}>
                    <Link href={`/projeler/${p.id}`} className="font-medium hover:text-brand">{p.name}</Link>
                    {p.code && <p className="text-xs text-muted">{p.code}</p>}
                  </td>
                  <td className={td}>{p.organizations?.name ?? "—"}</td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: lineColor(p.service_line) }} aria-hidden />
                      {line?.name ?? p.service_line}
                      {line && !line.is_active && <span className="text-xs text-muted">(pasif)</span>}
                    </span>
                  </td>
                  <td className={td}>{formatDate(p.end_date)}</td>
                  <td className={td}>
                    <Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        <Pagination path={PATH} searchParams={sp} total={count ?? 0} />
      </Card>
    </>
  );
}
