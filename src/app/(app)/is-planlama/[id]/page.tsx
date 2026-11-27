import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, FileDown, Pencil } from "lucide-react";
import { TaskRespond } from "@/components/tasks/task-respond";
import { Badge, Card, CardHeader, Notice, PageHeader, btn, cn } from "@/components/ui";
import { TaskForm } from "@/components/tasks/task-form";
import { AddTaskFiles, ScheduleForm, TaskStatusButtons } from "@/components/tasks/task-manage";
import { TaskFiles, TaskTimeline } from "@/components/tasks/task-parts";
import { requireTaskAccess } from "@/lib/tasks";
import { hasPermission } from "@/lib/auth";
import { isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { stageInfo, taskStage } from "@/lib/task-status";
import { assignablePersonnel, assignableProjects, assignableStaff, withAssigneeNames } from "@/lib/task-data";
import { isStaffTask, loadTaskDetail, taskPersonName } from "@/lib/task-detail";

export const metadata: Metadata = { title: "Görev" };

/** Görev sayfası: bilgiler, sorun / bitirdi bildirimi, tarih-saat, durum düğmeleri, dosyalar, geçmiş; ?duzenle=1 düzenleme. */
export default async function TaskPage({ params, searchParams }: PageProps<"/is-planlama/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const user = await requireTaskAccess();
  const supabase = await createClient();
  const [detail, assignable] = await Promise.all([loadTaskDetail(supabase, id), assignableProjects(user)]);
  if (!detail) notFound();
  const { events, files } = detail;
  const [t] = await withAssigneeNames([detail.task]);

  // merkez görevi: bir merkez kullanıcısına atanmış (proje ve personel yok); görevi merkezde tasks.assign yetkisi olan yönetir
  const staffTask = isStaffTask(t);
  const canManage = staffTask ? hasPermission(user, "tasks.assign") : assignable.some((p) => p.id === t.project_id);
  // görevin atandığı merkez kullanıcısı: kabul eder / sorun bildirir / bitirdim der
  const isAssignee = staffTask && user.kind === "staff" && t.assignee_id === user.id;
  const open = ["pending", "issue", "accepted"].includes(t.status);
  const editing = canManage && open && str1(sp.duzenle) === "1";
  const stage = taskStage(t);
  const s = stageInfo(stage, staffTask);
  const who = staffTask ? "Görevli" : "Personel";
  const personName = taskPersonName(t);
  const assigner = events.find((e) => e.kind === "created")?.actor_name ?? null;
  const people = editing && t.project_id ? await assignablePersonnel([t.project_id]) : [];
  const staffOptions = editing && staffTask ? await assignableStaff(user) : [];

  const facts: [string, ReactNode][] = [
    ...(staffTask
      ? ([[who, personName], ["Tür", "Merkez görevi"]] as [string, ReactNode][])
      : ([
          ["Personel", personName],
          ["Görevi", t.job ?? "—"],
          ["Proje", [t.projects?.name, t.projects?.organizations?.name].filter(Boolean).join(" · ") || "—"],
        ] as [string, ReactNode][])),
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
        description={staffTask ? [personName, "Merkez görevi"].join(" · ") : [t.personnel?.full_name, t.job, t.projects?.name].filter(Boolean).join(" · ")}
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
            <AlertTriangle className="size-5" aria-hidden /> {isAssignee ? "Sorun bildirdiniz" : `${who} sorun bildirdi`}{t.issue_at ? ` · ${formatDateTime(t.issue_at)}` : ""}
          </p>
          {t.issue_note && <p className="mt-2 whitespace-pre-line text-sm">{t.issue_note}</p>}
          {canManage && (
            <p className="mt-3 text-sm text-muted">
              Görevi <Link href={`/is-planlama/${t.id}?duzenle=1`} className="font-medium text-brand-hover underline">düzenleyip kaydedin</Link>: {staffTask ? "kullanıcıya" : "personele"} yeniden onaya gider. Gerekirse iptal edin.
            </p>
          )}
        </div>
      )}
      {stage === "finished" && (
        <div className="mb-6 rounded-2xl border border-success/30 bg-success-soft/60 p-4">
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="size-5" aria-hidden /> {isAssignee ? "İşi bitirdiğinizi bildirdiniz" : `${who} işi bitirdiğini bildirdi`} · {formatDateTime(t.finished_by_personnel_at)}
          </p>
          {t.finish_note && <p className="mt-2 whitespace-pre-line text-sm">{t.finish_note}</p>}
          {canManage && <p className="mt-2 text-sm text-muted">Kontrol ettikten sonra “Tamamlandı” ile kapatın.</p>}
        </div>
      )}

      {editing ? (
        <Card className="mb-6">
          <CardHeader
            title="Görevi düzenle"
            description={
              t.status === "issue"
                ? `Kaydedince görev ${staffTask ? "kullanıcıya" : "personele"} yeniden onaya gönderilir.`
                : staffTask
                  ? "Kullanıcıyı değiştirirseniz görev yeni kullanıcının onayına gider."
                  : "Personeli değiştirirseniz görev yeni personelin onayına gider."
            }
            action={<Link href={`/is-planlama/${t.id}`} className="text-sm text-muted hover:text-fg">Vazgeç</Link>}
          />
          <TaskForm
            projects={t.project_id ? [{ value: t.project_id, label: t.projects?.name ?? "Proje" }] : []}
            people={people}
            staff={staffOptions}
            initial={{
              id: t.id,
              target: staffTask ? "staff" : "field",
              assignee_id: t.assignee_id ?? "",
              project_id: t.project_id ?? "",
              personnel_id: t.personnel_id ?? "",
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
          {isAssignee && open && (
            <Card>
              <CardHeader
                title="Yanıtınız"
                description={
                  t.status === "pending"
                    ? "Bu görev size atandı. Kabul edin ya da sorun varsa yazın."
                    : t.status === "accepted" && !t.finished_by_personnel_at
                      ? "Görevi kabul ettiniz. İş bitince bildirin."
                      : undefined
                }
              />
              <div className="p-5">
                <TaskRespond id={t.id} status={t.status} finished={Boolean(t.finished_by_personnel_at)} />
              </div>
            </Card>
          )}
          {canManage && open && (
            <Card>
              <CardHeader
                title="Tarih ve saat"
                description={t.status === "accepted" ? `${who} kabul etti; işin tarihini ve saatini verin.` : `Kabulden önce de verebilirsiniz; ${who.toLocaleLowerCase("tr")} görür.`}
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
          {!canManage && !isAssignee && <Notice tone="brand">Bu görevi görüntüleyebilirsiniz; değişiklik yetkiniz yok.</Notice>}
          <Card>
            <CardHeader title="Geçmiş" />
            <div className="p-5 pl-7">
              <TaskTimeline events={events} staffTask={staffTask} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
