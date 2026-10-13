import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card, PageHeader, cn } from "@/components/ui";
import { MessageForm } from "@/components/forms/ops-forms";
import { hasPermission, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { markThreadRead, setThreadStatus } from "@/app/actions/messages";
import type { Message, Thread } from "@/lib/types";

type MessageRow = Message & { sender_name: string; sender_kind: "staff" | "customer" };

export default async function ThreadPage({ params }: PageProps<"/mesajlar/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("*, projects(name, organizations(name))")
    .eq("id", id)
    .maybeSingle();
  if (!thread) notFound();
  const t = thread as unknown as Thread;

  const { data } = await supabase.from("messages").select("*").eq("thread_id", id).order("created_at");
  const messages = (data ?? []) as unknown as MessageRow[];
  await markThreadRead(id);
  const canManage = hasPermission(user, "messages.manage");

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/mesajlar" className="inline-flex items-center gap-1 hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> Tüm konular
          </Link>
        }
        title={t.subject}
        description={`${t.projects?.organizations?.name ?? ""} · ${t.projects?.name ?? ""}`}
        actions={
          <>
            {t.status === "closed" && <Badge>Kapalı</Badge>}
            {canManage && (
              <form action={setThreadStatus}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value={t.status === "open" ? "closed" : "open"} />
                <button className="text-sm text-muted hover:text-fg">{t.status === "open" ? "Konuyu kapat" : "Yeniden aç"}</button>
              </form>
            )}
          </>
        }
      />

      <Card className="mx-auto max-w-3xl">
        <ol className="space-y-4 p-5">
          {messages.map((m) => {
            const mine = m.sender_id === user.id;
            const fromCenter = m.sender_kind === "staff";
            return (
              <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", mine ? "bg-brand text-brand-fg" : "bg-surface-2")}>
                  <p className={cn("mb-1 text-xs font-medium", mine ? "opacity-80" : "text-muted")}>
                    {mine ? "Siz" : fromCenter && user.kind === "customer" ? `Merkez · ${m.sender_name}` : m.sender_name}
                    {" · "}
                    {formatDateTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {t.status === "open" ? (
          <MessageForm key={messages.length} threadId={id} />
        ) : (
          <p className="border-t border-border p-5 text-sm text-muted">Bu konu kapatılmış. Yeni bir konu başlatabilirsiniz.</p>
        )}
      </Card>
    </>
  );
}
