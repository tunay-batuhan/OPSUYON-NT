import Link from "next/link";
import type { Metadata } from "next";
import { MessageSquarePlus } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ThreadForm } from "@/components/forms/ops-forms";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Thread } from "@/lib/types";

export const metadata: Metadata = { title: "Yazışmalar" };

export default async function MessagesPage({ searchParams }: PageProps<"/mesajlar">) {
  const user = await requireUser();
  const sp = await searchParams;
  const projectFilter = typeof sp.proje === "string" && /^[0-9a-f-]{36}$/i.test(sp.proje) ? sp.proje : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("threads")
    .select("*, projects(name, organizations(name))")
    .order("last_message_at", { ascending: false });
  if (projectFilter) query = query.eq("project_id", projectFilter);

  const [{ data: threads }, { data: projects }, { data: reads }] = await Promise.all([
    query,
    supabase.from("projects").select("id, name, organizations(name)").neq("status", "closed").order("name"),
    supabase.from("thread_reads").select("thread_id, last_read_at").eq("user_id", user.id),
  ]);

  const readMap = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at as string]));
  const list = (threads ?? []) as unknown as Thread[];
  const projectList = (projects ?? []) as unknown as { id: string; name: string; organizations: { name: string } | null }[];

  return (
    <>
      <PageHeader
        title={user.kind === "staff" ? "Yazışmalar" : "Merkez ile yazışma"}
        description={user.kind === "staff" ? "Müşterilerin gönderdiği konular ve yanıtlarınız." : "Sorularınızı ve taleplerinizi merkeze iletin."}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader title="Konular" description={projectFilter ? "Seçili projeye göre filtrelendi." : undefined} action={projectFilter ? <Link href="/mesajlar" className="text-sm text-brand">Filtreyi kaldır</Link> : undefined} />
          {list.length === 0 ? (
            <EmptyState title="Henüz yazışma yok" description="Yan taraftaki formdan yeni bir konu başlatabilirsiniz." />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((t) => {
                const lastRead = readMap.get(t.id);
                const unread = !lastRead || new Date(lastRead) < new Date(t.last_message_at);
                return (
                  <li key={t.id}>
                    <Link href={`/mesajlar/${t.id}`} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-surface-2">
                      <div className="min-w-0">
                        <p className={unread ? "font-semibold" : "font-medium"}>
                          {unread && <span className="mr-2 inline-block size-2 rounded-full bg-brand align-middle" aria-label="Okunmamış" />}
                          {t.subject}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {t.projects?.organizations?.name} · {t.projects?.name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted">{formatDateTime(t.last_message_at)}</p>
                        {t.status === "closed" && <Badge>Kapalı</Badge>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Yeni konu" action={<MessageSquarePlus className="size-4 text-muted" aria-hidden />} />
          {projectList.length === 0 ? (
            <EmptyState title="Yazışma başlatabileceğiniz proje yok" />
          ) : (
            <ThreadForm
              defaultProject={projectFilter}
              projects={projectList.map((p) => ({ value: p.id, label: `${p.organizations?.name ?? ""} — ${p.name}` }))}
            />
          )}
        </Card>
      </div>
    </>
  );
}
