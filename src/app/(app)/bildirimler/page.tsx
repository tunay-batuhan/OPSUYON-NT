import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileText, Inbox, MessageSquare } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { canAnywhere, isSuperAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/schemas-contact";
import { getEnabledModules } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, isoDayFromNow, isoTimeFromNow } from "@/lib/format";
import { loadExpiryAlerts } from "@/lib/expiry-alerts";
import { withAssigneeNames } from "@/lib/task-data";
import { taskPersonName } from "@/lib/task-detail";
import { ExpiryAlertList } from "@/components/expiry-alerts";

export const metadata: Metadata = { title: "Bildirimler" };

type Msg = { thread_id: string; body: string; sender_name: string; created_at: string; threads: { subject: string; projects: { name: string } | null } | null };

export default async function NotificationsPage() {
  const user = await requireUser();
  const showContracts = user.kind === "staff" || (await getEnabledModules()).has("yaklasan_sozlesme");
  const supabase = await createClient();
  const today = isoDayFromNow(0);
  const soon = isoDayFromNow(60);
  const weekAgo = isoTimeFromNow(-7 * 86400000);

  const [{ data: msgs }, { data: reads }, { data: contracts }, { data: docs }] = await Promise.all([
    supabase.from("messages").select("thread_id, body, sender_name, created_at, threads(subject, projects(name))").neq("sender_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("thread_reads").select("thread_id, last_read_at").eq("user_id", user.id),
    supabase.from("projects").select("id, name, end_date, organizations(name)").eq("status", "active").gte("end_date", today).lte("end_date", soon).order("end_date"),
    user.kind === "customer"
      ? supabase.from("documents").select("id, title, created_at, category_code, project_id, projects(name)").gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  // Web sitesi iletişim formundan gelen yeni mesajlar: yalnızca Süper Yönetici (tabloya oturumlu erişim yok, servis anahtarıyla)
  const { data: contactData } = isSuperAdmin(user)
    ? await createAdminClient().from("contact_messages").select("id, full_name, company, topic, created_at").eq("status", "yeni").order("created_at", { ascending: false }).limit(20)
    : { data: [] };
  const contactRows = (contactData ?? []) as { id: string; full_name: string; company: string | null; topic: ContactTopic; created_at: string }[];

  // İş Planlama: personelin sorun bildirdiği ve "İşi bitirdim" dediği görevler (RLS yalnızca görebildiklerini döndürür)
  const seesTasks = user.kind !== "personnel" && canAnywhere(user, "tasks.read") && (user.kind === "staff" || (await getEnabledModules()).has("is_planlama"));
  const { data: taskData } = seesTasks
    ? await supabase
        .from("work_tasks")
        .select("*, personnel(full_name), projects(name)")
        .or("status.eq.issue,and(status.eq.accepted,finished_by_personnel_at.not.is.null)")
        .order("updated_at", { ascending: false })
        .limit(30)
    : { data: [] };
  type TaskAlertRow = {
    id: string; title: string; status: string; issue_note: string | null; issue_at: string | null; finished_by_personnel_at: string | null;
    planned_date: string | null; created_at: string; assignee_id?: string | null; assignee_name?: string | null;
    personnel: { full_name: string } | null; projects: { name: string } | null;
  };
  const taskRows = await withAssigneeNames((taskData ?? []) as unknown as TaskAlertRow[]);

  // Merkez kullanıcısına atanmış, yanıtını (kabul / sorun) bekleyen merkez görevleri. Sütun henüz yoksa boş döner.
  const { data: myTaskData } = user.kind === "staff"
    ? await supabase.from("work_tasks").select("*").eq("assignee_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(30)
    : { data: [] };
  const myTaskRows = (myTaskData ?? []) as unknown as TaskAlertRow[];

  // Sağlık raporu / güvenlik kimlik kartı: bitişe 6 ay kala her gün (merkez, personel kartını görebilen)
  const expiryRows = await loadExpiryAlerts(user);

  const readMap = new Map((reads ?? []).map((r) => [r.thread_id as string, new Date(r.last_read_at as string).getTime()]));
  const unread = new Map<string, Msg>();
  for (const m of (msgs ?? []) as unknown as Msg[]) {
    if (new Date(m.created_at).getTime() > (readMap.get(m.thread_id) ?? 0) && !unread.has(m.thread_id)) unread.set(m.thread_id, m);
  }
  const threads = [...unread.values()];
  const contractRows = !showContracts ? [] : (contracts ?? []) as unknown as { id: string; name: string; end_date: string; organizations: { name: string } | null }[];
  const docRows = (docs ?? []) as unknown as { id: string; title: string; created_at: string; project_id: string; projects: { name: string } | null }[];
  const nothing = threads.length + contractRows.length + docRows.length + contactRows.length + taskRows.length + myTaskRows.length + expiryRows.length === 0;

  return (
    <>
      <PageHeader title="Bildirimler" description="Dikkat etmeniz gereken gelişmeler." />
      {nothing && <Card><EmptyState title="Yeni bildirim yok" description="Mesaj, belge ve yaklaşan sözleşme bildirimleri burada görünür." /></Card>}
      <div className="space-y-6">
        {expiryRows.length > 0 && (
          <Card>
            <CardHeader
              title="Süresi yaklaşan belgeler"
              description="Sağlık raporu ve güvenlik kimlik kartı: bitişe 6 ay kala her gün hatırlatılır. Kapatınca personele bildirim evrakı basmak isteyip istemediğiniz sorulur."
            />
            <ExpiryAlertList rows={expiryRows} />
          </Card>
        )}
        {contactRows.length > 0 && (
          <Card>
            <CardHeader title="Yeni iletişim talepleri" description="Web sitesindeki iletişim formundan" />
            <ul className="divide-y divide-border">
              {contactRows.map((c) => (
                <li key={c.id}>
                  <Link href={`/merkez/iletisim-talepleri/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <Inbox className="size-5 shrink-0 text-brand" aria-hidden />
                    <span className="flex-1"><span className="font-medium">{c.full_name}</span> <span className="text-muted">· {CONTACT_TOPICS[c.topic] ?? c.topic}{c.company ? ` · ${c.company}` : ""}</span></span>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(c.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {myTaskRows.length > 0 && (
          <Card>
            <CardHeader title="İş Planlama: size atanan görevler" description="Yanıtınızı bekliyor: kabul edin ya da sorun varsa yazın" />
            <ul className="divide-y divide-border">
              {myTaskRows.map((t) => (
                <li key={t.id}>
                  <Link href={`/is-planlama/${t.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2">
                    <ClipboardList className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{t.title}</span>
                      <span className="block text-sm text-muted">{t.planned_date ? `Görev tarihi ${formatDate(t.planned_date)}` : "Tarih henüz verilmedi"}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(t.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {taskRows.length > 0 && (
          <Card>
            <CardHeader title="İş Planlama: ilgilenmeniz gereken görevler" description="Görevi alanın sorun bildirdiği ya da bitirdiğini söylediği görevler" />
            <ul className="divide-y divide-border">
              {taskRows.map((t) => {
                const issue = t.status === "issue";
                return (
                  <li key={t.id}>
                    <Link href={`/is-planlama/${t.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2">
                      {issue ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {issue ? "Sorun bildirildi" : t.assignee_id ? "Görevli işi bitirdi" : "Personel işi bitirdi"}: {t.title}{" "}
                          <span className="font-normal text-muted">· {taskPersonName(t)}{t.projects?.name ? ` · ${t.projects.name}` : t.assignee_id ? " · Merkez" : ""}</span>
                        </span>
                        {issue && t.issue_note && <span className="block truncate text-sm text-muted">“{t.issue_note}”</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{formatDateTime((issue ? t.issue_at : t.finished_by_personnel_at) ?? new Date(0).toISOString())}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        {threads.length > 0 && (
          <Card>
            <CardHeader title="Okunmamış mesajlar" />
            <ul className="divide-y divide-border">
              {threads.map((m) => (
                <li key={m.thread_id}>
                  <Link href={`/mesajlar/${m.thread_id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2">
                    <MessageSquare className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{m.threads?.subject} <span className="font-normal text-muted">· {m.threads?.projects?.name}</span></span>
                      <span className="block truncate text-sm text-muted">{m.sender_name}: {m.body}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(m.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {contractRows.length > 0 && (
          <Card>
            <CardHeader title="Yaklaşan sözleşmeler" description="60 gün içinde biten aktif projeler" />
            <ul className="divide-y divide-border">
              {contractRows.map((p) => (
                <li key={p.id}>
                  <Link href={`/projeler/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <CalendarClock className="size-5 shrink-0 text-[var(--tone-amber)]" aria-hidden />
                    <span className="flex-1"><span className="font-medium">{p.name}</span> <span className="text-muted">· {p.organizations?.name}</span></span>
                    <span className="text-sm font-medium">{formatDate(p.end_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {docRows.length > 0 && (
          <Card>
            <CardHeader title="Yeni belgeler" description="Son 7 günde paylaşılanlar" />
            <ul className="divide-y divide-border">
              {docRows.map((d) => (
                <li key={d.id}>
                  <Link href={`/projeler/${d.project_id}/belgeler`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <FileText className="size-5 shrink-0 text-[var(--tone-emerald)]" aria-hidden />
                    <span className="flex-1"><span className="font-medium">{d.title}</span> <span className="text-muted">· {d.projects?.name}</span></span>
                    <span className="text-xs text-muted">{formatDateTime(d.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
