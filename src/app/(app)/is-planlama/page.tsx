import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Eye, FileDown, Hourglass } from "lucide-react";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, btn, cn, td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { NavyHeader, TaskForm } from "@/components/tasks/task-form";
import { requireAccess } from "@/lib/modules";
import { getAccessibleProjects, str1 } from "@/lib/lookups";
import { pagingFrom } from "@/lib/paging";
import { formatDate } from "@/lib/format";
import { TASK_STATUS, taskStage } from "@/lib/task-status";
import {
  assignablePersonnel, assignableProjects, filterQuery, loadTaskCounts, loadTasks, taskFiltersFrom, taskJobOptions, type TaskFilters,
} from "@/lib/task-data";

export const metadata: Metadata = { title: "İş Planlama" };

const STAGE_OPTIONS = [
  { value: "acik", label: "Açık görevler" },
  { value: "bekleyen", label: "Onay bekleyen" },
  { value: "tarih", label: "Tarih bekleyen" },
  { value: "planlanan", label: "Planlanan" },
  { value: "sorun", label: "Sorun bildirilen" },
  { value: "bitirdi", label: "Personel bitirdi" },
  { value: "tamam", label: "Tamamlanan" },
  { value: "iptal", label: "İptal" },
];

/**
 * İş Planlama: üstte Yeni Görev Atama (yetkisi olana), altta sayaçlar, süzgeç (personel, görevi, tarih aralığı, durum)
 * ve görev listesi; süzülen liste PDF olarak indirilebilir.
 */
export default async function TasksPage({ searchParams }: PageProps<"/is-planlama">) {
  const user = await requireAccess("is_planlama", "tasks.read");
  const sp = await searchParams;
  const f = taskFiltersFrom(sp);
  const { from, to } = pagingFrom(sp);

  const [projects, assignable, jobs, counts, { rows, total }] = await Promise.all([
    getAccessibleProjects(),
    assignableProjects(user),
    taskJobOptions(),
    loadTaskCounts(f),
    loadTasks(f, { from, to }),
  ]);
  const people = await assignablePersonnel(assignable.map((p) => p.id));
  const multiProject = projects.length > 1;
  const filtered = Boolean(f.projectId || f.name || f.job || f.from || f.stage);
  const withStage = (stage?: string): TaskFilters => ({ ...f, stage });

  const counters = [
    { stage: "bekleyen", n: counts.pending, label: "Onay Bekleyen", hint: "Personel kabulü bekleniyor", Icon: Hourglass, tone: "amber" },
    { stage: "planlanan", n: counts.planned, label: "Planlanan", hint: counts.waitingDate ? `Tarih/saat belli · ${counts.waitingDate} görev tarih bekliyor` : "Tarih/saat belirli", Icon: CalendarDays, tone: "blue" },
    { stage: "sorun", n: counts.issue, label: "Sorun Bildirilen", hint: "Açıklama bekliyor / müdahale", Icon: AlertTriangle, tone: "rose" },
    { stage: "tamam", n: counts.done, label: "Tamamlanan", hint: counts.finished ? `Toplam · ${counts.finished} görev onayınızı bekliyor` : "Toplam", Icon: CheckCircle2, tone: "emerald" },
  ] as const;

  return (
    <>
      <PageHeader
        title="İş Planlama"
        description="Personele görev atayın; personel telefonundan kabul eder ya da sorun bildirir. Kabul edilen göreve tarih/saat verin, iş bitince Tamamlandı ile kapatın."
      />

      {str1(sp.silindi) && <div className="mb-4"><Notice tone="success">Görev silindi.</Notice></div>}

      {assignable.length > 0 && (
        <Card className="mb-8">
          <NavyHeader title="Yeni Görev Atama" />
          <TaskForm projects={assignable.map((p) => ({ value: p.id, label: p.name }))} people={people} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <NavyHeader title="Görevler" icon="info" />
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          {counters.map((c) => {
            const active = f.stage === c.stage;
            return (
              <Link
                key={c.stage}
                href={`/is-planlama${filterQuery(withStage(active ? undefined : c.stage))}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 transition-colors",
                  active ? "border-[var(--a)] bg-[var(--a-soft)]" : "border-border bg-surface hover:bg-[var(--a-soft)]",
                )}
                style={{ ["--a" as string]: `var(--tone-${c.tone})`, ["--a-soft" as string]: `var(--tone-${c.tone}-soft)` }}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: `var(--tone-${c.tone}-soft)`, color: `var(--tone-${c.tone})` }}>
                  <c.Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-bold tabular-nums" style={{ color: `color-mix(in oklab, var(--tone-${c.tone}) 78%, black)` }}>{c.n}</span>
                  <span className="block font-semibold leading-tight">{c.label}</span>
                  <span className="block truncate text-xs text-muted">{c.hint}</span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 pb-0">
          <FilterBar
            action="/is-planlama"
            fields={[
              ...(multiProject ? [{ name: "proje", label: "Proje", value: f.projectId, all: "Tüm projeler", options: projects.map((p) => ({ value: p.id, label: p.name })) }] : []),
              { name: "ad", label: "Personel adı soyadı", kind: "text" as const, value: f.name, placeholder: "Ad soyad…" },
              { name: "gorev", label: "Görevi", value: f.job, all: "Tümü", options: jobs.map((j) => ({ value: j, label: j })) },
              { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange" as const, value: f.from, valueTo: f.to },
              { name: "durum", label: "Durum", value: f.stage, all: "Tümü", options: STAGE_OPTIONS },
            ]}
          >
            <a href={`/api/is-planlama/rapor${filterQuery(f)}`} className={btn("danger", "sm", "h-9")}>
              <FileDown className="size-4" aria-hidden /> PDF indir
            </a>
            {filtered && (
              <Link href="/is-planlama" className="self-center text-sm text-muted hover:text-fg">Süzgeci temizle</Link>
            )}
          </FilterBar>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "Süzgece uyan görev yok" : "Henüz görev yok"}
            description={assignable.length ? "Yukarıdaki “Yeni Görev Atama” ile ilk görevi atayın." : undefined}
          />
        ) : (
          <>
            <Table head={["#", "Personel adı soyadı", "Görevi", "Görev başlığı", ...(multiProject ? ["Proje"] : []), "Görev tarihi", "Saat", "Durum", ""]}>
              {rows.map((t, i) => {
                const stage = taskStage(t);
                const s = TASK_STATUS[stage];
                return (
                  <tr key={t.id} className={cn(stage === "issue" && "bg-danger-soft/30", stage === "finished" && "bg-success-soft/30")}>
                    <td className={cn(td, "tabular-nums text-muted")}>{from + i + 1}</td>
                    <td className={cn(td, "font-medium")}>{t.personnel?.full_name ?? "—"}</td>
                    <td className={cn(td, "text-muted")}>{t.job ?? "—"}</td>
                    <td className={td}>
                      <Link href={`/is-planlama/${t.id}`} className="font-medium hover:text-brand hover:underline">{t.title}</Link>
                      {t.location && <p className="text-xs text-muted">{t.location}</p>}
                      {stage === "issue" && t.issue_note && <p className="mt-0.5 line-clamp-2 text-xs text-danger">“{t.issue_note}”</p>}
                    </td>
                    {multiProject && <td className={cn(td, "text-muted")}>{t.projects?.name}</td>}
                    <td className={cn(td, "whitespace-nowrap")}>{t.planned_date ? formatDate(t.planned_date) : <span className="text-muted">—</span>}</td>
                    <td className={cn(td, "tabular-nums")}>{t.planned_time ? t.planned_time.slice(0, 5) : <span className="text-muted">—</span>}</td>
                    <td className={td}><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className={cn(td, "whitespace-nowrap text-right")}>
                      <Link href={`/is-planlama/${t.id}`} className="inline-flex items-center gap-1 rounded-lg p-1.5 text-brand hover:bg-brand-soft" aria-label={`${t.title} — görüntüle`} title="Görüntüle">
                        <Eye className="size-4" aria-hidden />
                      </Link>
                      <a href={`/api/is-planlama/${t.id}/pdf`} className="inline-flex items-center gap-1 rounded-lg p-1.5 text-danger hover:bg-danger-soft" aria-label={`${t.title} — PDF`} title="PDF indir">
                        <FileDown className="size-4" aria-hidden />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pagination path="/is-planlama" searchParams={sp} total={total} />
          </>
        )}
        {rows.length > 0 && (
          <p className="flex items-center gap-1.5 border-t border-border px-5 py-3 text-xs text-muted">
            <ClipboardCheck className="size-3.5" aria-hidden /> Görev tarihi verilmemiş görevlerde tarih süzgeci atama tarihine bakar.
          </p>
        )}
      </Card>
    </>
  );
}
