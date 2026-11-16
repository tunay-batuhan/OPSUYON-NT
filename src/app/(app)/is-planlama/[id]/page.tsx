import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, FileDown, Pencil } from "lucide-react";
import { Badge, Card, CardHeader, Notice, PageHeader, btn, cn } from "@/components/ui";
import { TaskForm } from "@/components/tasks/task-form";
import { AddTaskFiles, ScheduleForm, TaskStatusButtons } from "@/components/tasks/task-manage";
import { TaskFiles, TaskTimeline } from "@/components/tasks/task-parts";
import { requireAccess } from "@/lib/modules";
import { isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { TASK_STATUS, taskStage } from "@/lib/task-status";
import { assignablePersonnel, assignableProjects } from "@/lib/task-data";
import { loadTaskDetail } from "@/lib/task-detail";

export const metadata: Metadata = { title: "Görev" };

/** Görev sayfası: bilgiler, sorun / bitirdi bildirimi, tarih-saat, durum düğmeleri, dosyalar, geçmiş; ?duzenle=1 düzenleme. */
export default async function TaskPage({ params, searchParams }: PageProps<"/is-planlama/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const user = await requireAccess("is_planlama", "tasks.read");
  const supabase = await createClient();
  const [detail, assignable] = await Promise.all([loadTaskDetail(supabase, id), assignableProjects(user)]);
  if (!detail) notFound();
  const { task: t, events, files } = detail;

  const canManage = assignable.some((p) => p.id === t.project_id);
  const open = ["pending", "issue", "accepted"].includes(t.status);
  const editing = canManage && open && str1(sp.duzenle) === "1";
  const stage = taskStage(t);
  const s = TASK_STATUS[stage];
  const assigner = events.find((e) => e.kind === "created")?.actor_name ?? null;
  const people = editing ? await assignablePersonnel([t.project_id]) : [];

  const facts: [string, ReactNode][] = [
    ["Personel", t.personnel?.full_name ?? "—"],
    ["Görevi", t.job ?? "—"],
    ["Proje", [t.projects?.name, t.projects?.organizations?.name].filter(Boolean).join(" · ") || "—"],
    ["Görev yeri", t.location ?? "—"],
    ["Görev tarihi", t.planned_date ? `${formatDate(t.planned_date)}${t.planned_time ? ` · ${t.planned_time.slice(0, 5)}` : ""}` : "Henüz verilmedi"],
    ["Atayan", assigner ? `${assigner} · ${formatDateTime(t.created_at)}` : formatDateTime(t.created_at)],
    ...(t.accepted_at ? ([["Kabul", formatDateTime(t.accepted_at)]] as [string, ReactNode][]) : []),
    ...(t.completed_at ? ([["Tamamlandı", formatDateTime(t.completed_at)]] as [string, ReactNode][]) : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/is-planlama" className="inline-flex items-center gap-1 hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> İş Planlama
          </Link>
        }
        title={t.title}
        description={[t.personnel?.full_name, t.job, t.projects?.name].filter(Boolean).join(" · ")}
        actions={
          <>
            <Badge tone={s.tone}>{s.label}</Badge>
            <a href={`/api/is-planlama/${t.id}/pdf`} className={btn("secondary", "sm")}>
              <FileDown className="size-4" aria-hidden /> PDF
            </a>
            {canManage && open && !editing && (
              <Link href={`/is-planlama/${t.id}?duzenle=1`} className={btn("secondary", "sm")}>
                <Pencil className="size-4" aria-hidden /> Düzenle
              </Link>
            )}
          </>
        }
      />

      {stage === "issue" && (
        <div className="mb-6 rounded-2xl border border-danger/30 bg-danger-soft/60 p-4">
          <p className="flex items-center gap-2 font-semibold text-danger">
            <AlertTriangle className="size-5" aria-hidden /> Personel sorun bildirdi{t.issue_at ? ` · ${formatDateTime(t.issue_at)}` : ""}
          </p>
          {t.issue_note && <p className="mt-2 whitespace-pre-line text-sm">{t.issue_note}</p>}
          {canManage && (
            <p className="mt-3 text-sm text-muted">
              Görevi <Link href={`/is-planlama/${t.id}?duzenle=1`} className="font-medium text-brand-hover underline">düzenleyip kaydedin</Link>: personele yeniden onaya gider. Gerekirse iptal edin.
            </p>
          )}
        </div>
      )}
      {stage === "finished" && (
        <div className="mb-6 rounded-2xl border border-success/30 bg-success-soft/60 p-4">
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="size-5" aria-hidden /> Personel işi bitirdiğini bildirdi · {formatDateTime(t.finished_by_personnel_at)}
          </p>
          {t.finish_note && <p className="mt-2 whitespace-pre-line text-sm">{t.finish_note}</p>}
          {canManage && <p className="mt-2 text-sm text-muted">Kontrol ettikten sonra “Tamamlandı” ile kapatın.</p>}
        </div>
      )}

      {editing ? (
        <Card className="mb-6">
          <CardHeader
            title="Görevi düzenle"
            description={t.status === "issue" ? "Kaydedince görev personele yeniden onaya gönderilir." : "Personeli değiştirirseniz görev yeni personelin onayına gider."}
            action={<Link href={`/is-planlama/${t.id}`} className="text-sm text-muted hover:text-fg">Vazgeç</Link>}
          />
          <TaskForm
            projects={[{ value: t.project_id, label: t.projects?.name ?? "Proje" }]}
            people={people}
            initial={{
              id: t.id,
              project_id: t.project_id,
              personnel_id: t.personnel_id,
              title: t.title,
              job: t.job ?? "",
              description: t.description ?? "",
              location: t.location ?? "",
              planned_date: t.planned_date ?? "",
              planned_time: t.planned_time?.slice(0, 5) ?? "",
            }}
            submitLabel={t.status === "issue" ? "Kaydet ve yeniden gönder" : "Kaydet"}
            onDoneHref={`/is-planlama/${t.id}`}
          />
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Görev bilgileri" />
            <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
              <div className="sm:col-span-2">
                <dt className="text-muted">Görev açıklaması</dt>
                <dd className={cn("mt-0.5 whitespace-pre-line", !t.description && "text-muted")}>{t.description || "—"}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title={`Fotoğraf ve belgeler (${files.length})`} action={canManage && t.status !== "cancelled" ? <AddTaskFiles id={t.id} /> : undefined} />
            <div className="p-5">
              <TaskFiles files={files} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {canManage && open && (
            <Card>
              <CardHeader
                title="Tarih ve saat"
                description={t.status === "accepted" ? "Personel kabul etti; işin tarihini ve saatini verin." : "Kabulden önce de verebilirsiniz; personel görür."}
              />
              <div className="p-5">
                <ScheduleForm id={t.id} date={t.planned_date} time={t.planned_time} />
              </div>
            </Card>
          )}
          {canManage && (
            <Card>
              <CardHeader title="İşlemler" description={s.hint} />
              <div className="p-5">
                <TaskStatusButtons id={t.id} status={t.status} title={t.title} />
              </div>
            </Card>
          )}
          {!canManage && <Notice tone="brand">Bu görevi görüntüleyebilirsiniz; değişiklik yetkiniz yok.</Notice>}
          <Card>
            <CardHeader title="Geçmiş" />
            <div className="p-5 pl-7">
              <TaskTimeline events={events} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
