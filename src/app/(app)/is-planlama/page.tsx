import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Eye, FileDown, Hourglass } from "lucide-react";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, btn, cn, td } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { NavyHeader, TaskForm } from "@/components/tasks/task-form";
import { requireTaskAccess } from "@/lib/tasks";
import { hasPermission } from "@/lib/auth";
import { getAccessibleProjects, str1 } from "@/lib/lookups";
import { pagingFrom } from "@/lib/paging";
import { formatDate } from "@/lib/format";
import { stageInfo, taskStage } from "@/lib/task-status";
import { isStaffTask, taskPersonName } from "@/lib/task-detail";
import {
  assignablePersonnel, assignableProjects, assignableStaff, filterQuery, loadTaskCounts, loadTasks, myPendingTaskCount, taskFiltersFrom, taskJobOptions,
  TASK_SCOPE_LABELS, type TaskFilters, type TaskScope,
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
 * Merkezde liste üç sekmedir: Saha görevleri (projedeki personele), Merkez görevleri (merkez kullanıcılarına) ve
 * Bana atananlar (oturumdaki kullanıcıya). Müşteri yalnızca kendi projelerinin saha görevlerini görür.
 */
export default async function TasksPage({ searchParams }: PageProps<"/is-planlama">) {
  const user = await requireTaskAccess();
  const sp = await searchParams;
  const f = taskFiltersFrom(sp, user);
  const { from, to } = pagingFrom(sp);
  const isStaff = user.kind === "staff";
  const staffView = f.scope === "merkez" || f.scope === "bana";

  const [projects, assignable, staffOptions, jobs, counts, { rows, total }, myPending] = await Promise.all([
    getAccessibleProjects(),
    assignableProjects(user),
    assignableStaff(user),
    taskJobOptions(),
    loadTaskCounts(f),
    loadTasks(f, { from, to }),
    isStaff ? myPendingTaskCount(user.id) : Promise.resolve(0),
  ]);
  const people = await assignablePersonnel(assignable.map((p) => p.id));
  const multiProject = projects.length > 1 && !staffView;
  const filtered = Boolean(f.projectId || f.name || f.job || f.from || f.stage);
  const withStage = (stage?: string): TaskFilters => ({ ...f, stage });
  const who = staffView ? "Görevli" : "Personel";
  // sekmeler: saha görevlerini göremeyen merkez kullanıcısında (tasks.read yok) yalnızca kendisine atananlar
  const scopes: TaskScope[] = !isStaff ? [] : hasPermission(user, "tasks.read") ? ["saha", "merkez", "bana"] : ["bana"];

  const counters = [
    { stage: "bekleyen", n: counts.pending, label: "Onay Bekleyen", hint: f.scope === "bana" ? "Yanıtınız bekleniyor" : `${who} kabulü bekleniyor`, Icon: Hourglass, tone: "amber" },
    { stage: "planlanan", n: counts.planned, label: "Planlanan", hint: counts.waitingDate ? `Tarih/saat belli · ${counts.waitingDate} görev tarih bekliyor` : "Tarih/saat belirli", Icon: CalendarDays, tone: "blue" },
    { stage: "sorun", n: counts.issue, label: "Sorun Bildirilen", hint: "Açıklama bekliyor / müdahale", Icon: AlertTriangle, tone: "rose" },
    { stage: "tamam", n: counts.done, label: "Tamamlanan", hint: counts.finished ? (f.scope === "bana" ? `Toplam · ${counts.finished} görev onay bekliyor` : `Toplam · ${counts.finished} görev onayınızı bekliyor`) : "Toplam", Icon: CheckCircle2, tone: "emerald" },
  ] as const;

  return (
    <>
      <PageHeader
        title="İş Planlama"
        description={
          isStaff
            ? "Saha personeline ya da merkez kullanıcısına görev atayın; görevi alan kabul eder ya da sorun bildirir. Kabul edilen göreve tarih/saat verin, iş bitince Tamamlandı ile kapatın."
            : "Personele görev atayın; personel telefonundan kabul eder ya da sorun bildirir. Kabul edilen göreve tarih/saat verin, iş bitince Tamamlandı ile kapatın."
        }
      />

      {str1(sp.silindi) && <div className="mb-4"><Notice tone="success">Görev silindi.</Notice></div>}

      {(assignable.length > 0 || staffOptions.length > 0) && (
        <Card className="mb-8">
          <NavyHeader title="Yeni Görev Atama" />
          <TaskForm
            // sekme değişince form o sekmenin türüyle açılır (merkez sekmelerinde "Merkez kullanıcısı" seçili)
            key={staffView ? "staff" : "field"}
            projects={assignable.map((p) => ({ value: p.id, label: p.name }))}
            people={people}
            staff={staffOptions}
            initial={staffView && staffOptions.length > 0 ? { target: "staff" } : undefined}
          />
        </Card>
      )}

      {scopes.length > 1 && (
        <nav aria-label="Görev türü" className="no-scrollbar mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 shadow-card">
          {scopes.map((sc) => {
            const active = f.scope === sc;
            const badge = sc === "bana" ? myPending : 0;
            return (
              <Link
                key={sc}
                href={`/is-planlama${filterQuery({ scope: sc })}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors",
                  active ? "bg-brand text-brand-fg shadow-sm" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {TASK_SCOPE_LABELS[sc]}
                {badge > 0 && (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", active ? "bg-white/20 text-brand-fg" : "bg-danger text-white")} title="Yanıtınızı bekleyen görev">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}

      <Card className="overflow-hidden">
        <NavyHeader title={f.scope && isStaff ? TASK_SCOPE_LABELS[f.scope] : "Görevler"} icon="info" />
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
              ...(f.scope === "bana" ? [] : [{ name: "ad", label: staffView ? "Kullanıcı adı soyadı" : "Personel adı soyadı", kind: "text" as const, value: f.name, placeholder: "Ad soyad…" }]),
              ...(staffView ? [] : [{ name: "gorev", label: "Görevi", value: f.job, all: "Tümü", options: jobs.map((j) => ({ value: j, label: j })) }]),
              { name: "bas", nameTo: "bit", label: "Tarih aralığı", kind: "daterange" as const, value: f.from, valueTo: f.to },
              { name: "durum", label: "Durum", value: f.stage, all: "Tümü", options: STAGE_OPTIONS },
            ]}
          >
            {/* süzgeç gönderilince sekme korunur */}
            {f.scope && f.scope !== "saha" && <input type="hidden" name="tur" value={f.scope} />}
            <a href={`/api/is-planlama/rapor${filterQuery(f)}`} className={btn("danger", "sm", "h-9")}>
              <FileDown className="size-4" aria-hidden /> PDF indir
            </a>
            {filtered && (
              <Link href={`/is-planlama${filterQuery({ scope: f.scope })}`} className="self-center text-sm text-muted hover:text-fg">Süzgeci temizle</Link>
            )}
          </FilterBar>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "Süzgece uyan görev yok" : f.scope === "bana" ? "Size atanmış görev yok" : f.scope === "merkez" ? "Henüz merkez görevi yok" : "Henüz görev yok"}
            description={
              f.scope === "bana"
                ? "Size görev atandığında burada ve zilde görünür."
                : (staffView ? staffOptions.length : assignable.length)
                  ? "Yukarıdaki “Yeni Görev Atama” ile ilk görevi atayın."
                  : undefined
            }
          />
        ) : (
          <>
            <Table head={["#", staffView ? "Görevli" : "Personel adı soyadı", ...(staffView ? [] : ["Görevi"]), "Görev başlığı", ...(multiProject ? ["Proje"] : []), "Görev tarihi", "Saat", "Durum", ""]}>
              {rows.map((t, i) => {
                const stage = taskStage(t);
                const s = stageInfo(stage, isStaffTask(t));
                const mine = isStaff && Boolean(t.assignee_id) && t.assignee_id === user.id;
                return (
                  <tr key={t.id} className={cn(stage === "issue" && "bg-danger-soft/30", stage === "finished" && "bg-success-soft/30")}>
                    <td className={cn(td, "tabular-nums text-muted")}>{from + i + 1}</td>
                    <td className={cn(td, "font-medium")}>
                      {taskPersonName(t)}
                      {mine && f.scope !== "bana" && <span className="ml-1.5 text-xs font-normal text-muted">(ben)</span>}
                    </td>
                    {!staffView && <td className={cn(td, "text-muted")}>{t.job ?? "—"}</td>}
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
