import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, FileText, MessageSquare } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, isoDayFromNow, isoTimeFromNow } from "@/lib/format";

export const metadata: Metadata = { title: "Bildirimler" };

type Msg = { thread_id: string; body: string; sender_name: string; created_at: string; threads: { subject: string; projects: { name: string } | null } | null };

export default async function NotificationsPage() {
  const user = await requireUser();
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

  const readMap = new Map((reads ?? []).map((r) => [r.thread_id as string, new Date(r.last_read_at as string).getTime()]));
  const unread = new Map<string, Msg>();
  for (const m of (msgs ?? []) as unknown as Msg[]) {
    if (new Date(m.created_at).getTime() > (readMap.get(m.thread_id) ?? 0) && !unread.has(m.thread_id)) unread.set(m.thread_id, m);
  }
  const threads = [...unread.values()];
  const contractRows = (contracts ?? []) as unknown as { id: string; name: string; end_date: string; organizations: { name: string } | null }[];
  const docRows = (docs ?? []) as unknown as { id: string; title: string; created_at: string; project_id: string; projects: { name: string } | null }[];
  const nothing = threads.length + contractRows.length + docRows.length === 0;

  return (
    <>
      <PageHeader title="Bildirimler" description="Dikkat etmeniz gereken gelişmeler." />
      {nothing && <Card><EmptyState title="Yeni bildirim yok" description="Mesaj, belge ve yaklaşan sözleşme bildirimleri burada görünür." /></Card>}
      <div className="space-y-6">
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
