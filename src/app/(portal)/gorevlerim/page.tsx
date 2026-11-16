import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PersonnelTaskCard, type PortalTask } from "@/components/tasks/personnel-task-card";
import { TaskFiles } from "@/components/tasks/task-parts";
import { requirePersonnel } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskFile } from "@/lib/task-detail";
import { isoDayFromNow } from "@/lib/format";

export const metadata: Metadata = { title: "Görevlerim" };

type Row = Omit<PortalTask, "project"> & { completed_at: string | null; projects: { name: string } | null };

/**
 * Personelin görevleri. Yalnızca kendi görevleri okunur: servis istemcisi, oturumdaki personelin kimliğiyle süzer
 * (personel proje / personel tablolarını göremez; görev adı ve proje adı buradan gelir).
 */
export default async function MyTasksPage() {
  const me = await requirePersonnel();
  const admin = createAdminClient();
  const since = isoDayFromNow(-30);
  const cols = "id, title, job, description, location, planned_date, planned_time, status, issue_note, finished_by_personnel_at, finish_note, completed_at, projects(name)";
  const [{ data: open }, { data: done }] = await Promise.all([
    admin.from("work_tasks").select(cols).eq("personnel_id", me.personnel_id).in("status", ["pending", "issue", "accepted"]).order("planned_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(100),
    admin.from("work_tasks").select(cols).eq("personnel_id", me.personnel_id).eq("status", "done").gte("completed_at", since).order("completed_at", { ascending: false }).limit(20),
  ]);
  const rows = [...((open ?? []) as unknown as Row[]), ...((done ?? []) as unknown as Row[])];
  const ids = rows.map((r) => r.id);
  const { data: fileRows } = ids.length
    ? await admin.from("work_task_files").select("id, task_id, stage, file_name, mime_type, size_bytes, created_at").in("task_id", ids).order("created_at")
    : { data: [] };
  const filesOf = new Map<string, TaskFile[]>();
  for (const f of (fileRows ?? []) as (TaskFile & { task_id: string })[]) filesOf.set(f.task_id, [...(filesOf.get(f.task_id) ?? []), f]);

  const toCard = (r: Row): PortalTask => ({ ...r, project: r.projects?.name ?? null });
  const groups: { title: string; hint: string; items: Row[] }[] = [
    { title: "Yanıtınızı bekleyen", hint: "Kabul edin ya da sorun varsa yazın", items: rows.filter((r) => r.status === "pending") },
    { title: "Yapılacak işlerim", hint: "Kabul ettiğiniz görevler", items: rows.filter((r) => r.status === "accepted") },
    { title: "Sorun bildirdiklerim", hint: "Müdürünüz inceliyor", items: rows.filter((r) => r.status === "issue") },
    { title: "Son tamamlananlar", hint: "Son 30 gün", items: rows.filter((r) => r.status === "done") },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Görevlerim</h1>
      <p className="mt-1 text-sm text-muted">Merhaba {me.full_name.split(" ")[0]}. Size atanan görevler aşağıda.</p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <ClipboardList className="mx-auto size-10 text-muted" aria-hidden />
          <p className="mt-3 font-semibold">Şu an size atanmış görev yok</p>
          <p className="mt-1 text-sm text-muted">Yeni görev atandığında burada görünür.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.title} aria-label={g.title}>
                <h2 className="flex items-baseline justify-between gap-2 text-base font-bold">
                  {g.title} <span className="text-sm font-medium text-muted">{g.items.length}</span>
                </h2>
                <p className="mb-3 text-xs text-muted">{g.hint}</p>
                <div className="space-y-4">
                  {g.items.map((r) => (
                    <PersonnelTaskCard
                      key={r.id}
                      task={toCard(r)}
                      files={filesOf.get(r.id)?.length ? <TaskFiles files={filesOf.get(r.id)!} /> : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
