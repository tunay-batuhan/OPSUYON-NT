import Link from "next/link";
import type { Metadata } from "next";
import { Ban, Clock, DoorOpen, FileDown, Package, PackageOpen, Users } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, btn, cn, td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { VisitorDesk } from "@/components/visitors/visitor-desk";
import { NavyHeader } from "@/components/tasks/task-form";
import { requireAccess } from "@/lib/modules";
import { getAccessibleProjects } from "@/lib/lookups";
import { pagingFrom } from "@/lib/paging";
import { dayTime, hhmm, logStatus } from "@/lib/visitor-shared";
import { STATUS_OPTIONS, filterQuery, loadCounts, loadDesk, loadLogs, logFiltersFrom, recordableProjects } from "@/lib/visitors";

export const metadata: Metadata = { title: "Ziyaretçi Takip" };

/**
 * Ziyaretçi Takip (müşteri: site yönetimi · merkez). Üstte seçili projenin ziyaretçi / kargo defteri (kayıt yetkisi
 * olana; güvenlik görevlisi aynı defteri telefonundan kullanır), altta sayaçlar, süzgeç, kayıtlar ve günlük rapor PDF.
 */
export default async function VisitorsPage({ searchParams }: PageProps<"/ziyaretciler">) {
  const user = await requireAccess("ziyaretci", "visitors.read");
  const sp = await searchParams;
  const f = logFiltersFrom(sp);
  const { from, to } = pagingFrom(sp);
  const [projects, recordable, counts, { rows, total }] = await Promise.all([
    getAccessibleProjects(),
    recordableProjects(user),
    loadCounts(f),
    loadLogs(f, { from, to }),
  ]);
  const multiProject = projects.length > 1;
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  // defter: süzgeçte seçili proje (kayıt yetkisi varsa) ya da tek proje
  const deskProject =
    recordable.find((p) => p.id === f.projectId) ?? (user.kind === "customer" && recordable.length === 1 ? recordable[0] : undefined);
  const desk = deskProject ? await loadDesk(deskProject.id) : null;
  const q = filterQuery(f);

  const counters = [
    { n: counts.visitors, label: "Ziyaretçi", hint: "Seçili tarihlerde", Icon: Users, tone: "blue", status: undefined },
    { n: counts.inside, label: "İçeride", hint: "Çıkışı işaretlenmemiş", Icon: DoorOpen, tone: "teal", status: "iceride" },
    { n: counts.pending, label: "Onay bekleyen", hint: "Sakine ulaşılamadı", Icon: Clock, tone: "amber", status: "bekliyor" },
    { n: counts.rejected, label: "Reddedilen", hint: "İçeri alınmadı", Icon: Ban, tone: "rose", status: "reddedildi" },
    { n: counts.cargo, label: "Kargo / teslimat", hint: "Seçili tarihlerde", Icon: Package, tone: "violet", status: undefined },
    { n: counts.cargoWaiting, label: "Kulübede bekleyen", hint: "Teslim edilmedi", Icon: PackageOpen, tone: "amber", status: "kargo_bekliyor" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Ziyaretçi Takip"
        description="Güvenliğin deftere yazdığı ziyaretçi ve kargo kayıtları: giriş-çıkış saatleri, plaka, gidilen daire / firma, sakin onayı ve teslimatlar. Günlük raporu PDF olarak alın."
      />

      {desk && deskProject && (
        <section aria-label="Ziyaretçi defteri" className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Ziyaretçi defteri · {deskProject.name}</h2>
          <div className="max-w-3xl">
            <VisitorDesk projectId={deskProject.id} desk={desk} myPersonnelId={null} canDeleteAny ownDeleteSince="" />
          </div>
        </section>
      )}
      {!desk && recordable.length > 0 && (
        <p className="mb-6 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">Deftere kayıt girmek için aşağıdaki süzgeçte bir <strong>Proje</strong> seçin.</p>
      )}

      <Card className="overflow-hidden">
        <NavyHeader title="Kayıtlar" icon="info" />
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3 xl:grid-cols-6">
          {counters.map((c) => {
            const active = Boolean(c.status) && f.status === c.status;
            const body = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: `var(--tone-${c.tone}-soft)`, color: `var(--tone-${c.tone})` }}>
                  <c.Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-bold tabular-nums">{c.n}</span>
                  <span className="block font-semibold leading-tight">{c.label}</span>
                  <span className="block truncate text-xs text-muted">{c.hint}</span>
                </span>
              </>
            );
            const cls = cn("flex items-center gap-3 rounded-xl border p-3", active ? "border-brand bg-brand-soft" : "border-border bg-surface");
            return c.status ? (
              <Link key={c.label} href={`/ziyaretciler${filterQuery({ ...f, status: active ? undefined : c.status })}`} aria-current={active ? "true" : undefined} className={cn(cls, "hover:bg-surface-2")}>
                {body}
              </Link>
            ) : (
              <div key={c.label} className={cls}>{body}</div>
            );
          })}
        </div>

        <div className="p-4 pb-0">
          <FilterBar
            action="/ziyaretciler"
            fields={[
              ...(multiProject ? [{ name: "proje", label: "Proje", value: f.projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) }] : []),
              { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange" as const, value: f.from, valueTo: f.to },
              { name: "tur", label: "Tür", value: f.kind, all: "Tümü", options: [{ value: "ziyaretci", label: "Ziyaretçi" }, { value: "kargo", label: "Kargo / teslimat" }] },
              { name: "durum", label: "Durum", value: f.status, all: "Tümü", options: STATUS_OPTIONS },
              { name: "ara", label: "Ara", kind: "text" as const, value: f.q, placeholder: "Ad, plaka, daire, telefon…" },
            ]}
          >
            <a href={`/api/ziyaretciler/rapor${q}`} className={btn("danger", "sm", "h-9")}>
              <FileDown className="size-4" aria-hidden /> Rapor (PDF)
            </a>
          </FilterBar>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Bu süzgece uyan kayıt yok" description="Tarih aralığını genişletin ya da süzgeci temizleyin." />
        ) : (
          <>
            <Table head={["Giriş", "Tür", "Ad soyad / firma", "Telefon", "Plaka", "Nereye", ...(multiProject ? ["Proje"] : []), "Durum", "Çıkış / teslim", "Kaydeden"]}>
              {rows.map((l) => {
                const s = logStatus(l);
                const multiDay = f.from !== f.to;
                return (
                  <tr key={l.id} className={cn(l.approval === "reddedildi" && "bg-danger-soft/30")}>
                    <td className={cn(td, "whitespace-nowrap tabular-nums")}>{multiDay ? dayTime(l.entered_at) : hhmm(l.entered_at)}</td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {l.kind === "kargo" ? <Package className="size-4 text-muted" aria-hidden /> : <Users className="size-4 text-muted" aria-hidden />}
                        {l.kind === "kargo" ? "Kargo" : "Ziyaretçi"}
                      </span>
                    </td>
                    <td className={td}>
                      <p className="font-medium">{l.kind === "kargo" ? `${l.courier} · ${l.package_count} paket` : l.full_name}</p>
                      {l.kind === "kargo" && l.full_name && <p className="text-xs text-muted">Kurye: {l.full_name}</p>}
                      {l.note && <p className="text-xs text-muted">{l.note}</p>}
                    </td>
                    <td className={cn(td, "whitespace-nowrap")}>{l.phone ? <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="text-brand-hover hover:underline">{l.phone}</a> : <span className="text-muted">—</span>}</td>
                    <td className={cn(td, "whitespace-nowrap font-mono text-sm")}>{l.plate ?? <span className="font-sans text-muted">—</span>}</td>
                    <td className={td}>{l.destination}</td>
                    {multiProject && <td className={cn(td, "text-muted")}>{projectName.get(l.project_id)}</td>}
                    <td className={td}><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className={cn(td, "whitespace-nowrap tabular-nums")}>
                      {l.kind === "kargo"
                        ? l.delivered_at ? <>{hhmm(l.delivered_at)}{l.delivered_to && <span className="block text-xs text-muted">{l.delivered_to}</span>}</> : <span className="text-muted">—</span>
                        : l.exited_at ? hhmm(l.exited_at) : <span className="text-muted">—</span>}
                    </td>
                    <td className={cn(td, "text-sm text-muted")}>{l.recorder ?? "—"}</td>
                  </tr>
                );
              })}
            </Table>
            <Pagination path="/ziyaretciler" searchParams={sp} total={total} />
          </>
        )}
      </Card>
    </>
  );
}
