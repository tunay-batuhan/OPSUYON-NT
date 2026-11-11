import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, cn, td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { PATROL_LINES } from "./lines";
import { requireStaff } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { PATROL_KEEP_DAYS, fmtDateTime } from "@/lib/patrol";

export const metadata: Metadata = { title: "Devriye Noktaları" };

/** Saklama süresinin başı (bu tarihten eski okutmalar silinmiştir). */
const keepSince = () => new Date(Date.now() - PATROL_KEEP_DAYS * 86400000).toISOString();

const PATH = "/devriye/noktalar";

/**
 * Merkez: devriye yapılabilen projeler. Her satır projenin nokta sayısını, PIN durumunu ve son okutmayı gösterir;
 * proje açılınca noktalar (ekle, adlandır, sırala, etiket), PIN ve konumlar tek ekranda yönetilir.
 */
export default async function PatrolProjectsPage({ searchParams }: PageProps<"/devriye/noktalar">) {
  await requireStaff("patrol.manage");
  await requireModule("devriye");
  const sp = await searchParams;
  // eski bağlantılar (?proje=…) projenin ekranına gider
  const old = str1(sp.proje);
  if (isUuid(old)) redirect(`${PATH}/${old}`);
  const ara = (str1(sp.ara) ?? "").trim().toLocaleLowerCase("tr");

  // yalnızca aktif (ve duraklatılmış) projeler; pasif projede devriye yönetilmez
  const projects = (await getAccessibleProjects()).filter((p) => PATROL_LINES.includes(p.service_line) && p.status !== "closed");
  const ids = projects.map((p) => p.id);
  const since = keepSince();
  const supabase = await createClient();
  const [{ data: points }, { data: pins }, { data: scans }] = ids.length
    ? await Promise.all([
        // yalnızca kontrol noktaları sayılır; "Devriye başlat / bitir" etiketi (kind 'tur') nokta değildir
        supabase.from("patrol_points").select("project_id, is_active").in("project_id", ids).eq("kind", "nokta"),
        supabase.from("patrol_pins").select("project_id, pin").in("project_id", ids),
        supabase.from("patrol_scans").select("project_id, scanned_at").in("project_id", ids).gte("scanned_at", since).order("scanned_at", { ascending: false }).limit(5000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const active = new Map<string, number>();
  const passive = new Map<string, number>();
  for (const p of points ?? []) {
    const m = p.is_active ? active : passive;
    m.set(p.project_id as string, (m.get(p.project_id as string) ?? 0) + 1);
  }
  const pinOf = new Map((pins ?? []).map((p) => [p.project_id as string, p.pin as string]));
  const lastScan = new Map<string, string>();
  for (const s of scans ?? []) if (!lastScan.has(s.project_id as string)) lastScan.set(s.project_id as string, s.scanned_at as string);

  const total = (id: string) => (active.get(id) ?? 0) + (passive.get(id) ?? 0);
  const rows = projects
    .filter((p) => !ara || p.name.toLocaleLowerCase("tr").includes(ara) || (p.organizations?.name ?? "").toLocaleLowerCase("tr").includes(ara))
    // noktası olan projeler üstte
    .sort((a, b) => Number(total(b.id) > 0) - Number(total(a.id) > 0) || a.name.localeCompare(b.name, "tr"));

  return (
    <>
      {projects.length > 8 && <FilterBar action={PATH} fields={[{ name: "ara", label: "Proje", kind: "text", value: str1(sp.ara), placeholder: "Proje veya firma adı…" }]} />}
      <Card>
        <CardHeader title={`${rows.length} proje`} description="Bir projeyi açın: noktalarını ekleyip adlandırın, başlat / bitir etiketiyle birlikte etiketlerini yazdırın ve projeye PIN verin (PIN yalnızca devriye başlatılırken sorulur)." />
        {rows.length === 0 ? (
          <EmptyState
            title={ara ? "Aramaya uyan proje yok" : "Devriye için uygun proje yok"}
            description={ara ? undefined : "Devriye; aktif Güvenlik, Danışma ve Tesis Yönetimi projelerinde kullanılır. Pasif projeler burada görünmez."}
          />
        ) : (
          <Table head={["Proje", "Firma", "Noktalar", "PIN", "Son okutma", ""]}>
            {rows.map((p) => {
              const a = active.get(p.id) ?? 0;
              const ps = passive.get(p.id) ?? 0;
              const pin = pinOf.get(p.id);
              const last = lastScan.get(p.id);
              const href = `${PATH}/${p.id}`;
              return (
                <tr key={p.id} className="group">
                  <td className={cn(td, "font-medium")}>
                    <Link href={href} className="hover:text-brand hover:underline">{p.name}</Link>
                    {p.status === "paused" && <span className="ml-2"><Badge tone="warning">Duraklatıldı</Badge></span>}
                  </td>
                  <td className={cn(td, "text-muted")}>{p.organizations?.name ?? "—"}</td>
                  <td className={td}>
                    {a + ps === 0 ? (
                      <span className="text-muted">Nokta yok</span>
                    ) : (
                      <span className="tabular-nums">
                        {a} aktif{ps > 0 && <span className="text-muted"> · {ps} pasif</span>}
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    {pin ? <span className="font-mono font-semibold tracking-[0.25em] tabular-nums">{pin}</span> : <Badge tone="warning">PIN yok</Badge>}
                  </td>
                  <td className={cn(td, "whitespace-nowrap tabular-nums", !last && "text-muted")}>{last ? fmtDateTime(last) : "—"}</td>
                  <td className={cn(td, "text-right")}>
                    <Link href={href} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">
                      Noktaları yönet <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
