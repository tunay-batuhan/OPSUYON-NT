"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guard, pgMessage, str, validate } from "@/lib/form";
import { messageSchema, threadSchema, type MessageValues, type ThreadValues } from "@/lib/schemas";
import type { ActionState } from "@/lib/action-types";

export async function createThread(values: ThreadValues): Promise<ActionState> {
  return guard(async () => {
    const user = await getCurrentUser();
    if (!user) return { error: "Oturum süresi doldu. Lütfen yeniden giriş yapın." };
    const v = validate(threadSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const threadId = crypto.randomUUID();
    // RLS (threads_insert) verifies messages.use on the project; no SELECT-back needed.
    const { error } = await supabase
      .from("threads")
      .insert({ id: threadId, project_id: d.project_id, subject: d.subject, created_by: user.id });
    if (error) return { error: pgMessage(error) };

    const { error: mErr } = await supabase.from("messages").insert({ thread_id: threadId, sender_id: user.id, body: d.body });
    if (mErr) return { error: pgMessage(mErr) };

    revalidatePath("/mesajlar");
    redirect(`/mesajlar/${threadId}`);
  });
}

export async function sendMessage(values: MessageValues): Promise<ActionState> {
  return guard(async () => {
    const user = await getCurrentUser();
    if (!user) return { error: "Oturum süresi doldu. Lütfen yeniden giriş yapın." };
    const v = validate(messageSchema, values);
    if (!v.ok) return v.state;
    const d = v.data;

    const supabase = await createClient();
    const { error } = await supabase.from("messages").insert({ thread_id: d.thread_id, sender_id: user.id, body: d.body });
    if (error) return { error: pgMessage(error) };
    revalidatePath(`/mesajlar/${d.thread_id}`);
    revalidatePath("/mesajlar");
    return { ok: true };
  });
}

export async function markThreadRead(threadId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("thread_reads")
    .upsert({ thread_id: threadId, user_id: user.id, last_read_at: new Date().toISOString() });
}

export async function setThreadStatus(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "messages.manage")) return;
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || (status !== "open" && status !== "closed")) return;
  const supabase = await createClient();
  await supabase.from("threads").update({ status }).eq("id", id);
  revalidatePath(`/mesajlar/${id}`);
  revalidatePath("/mesajlar");
}
