"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CalendarClock, CheckCheck, Loader2, Paperclip, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import { deleteTask, scheduleTask, setTaskStatus } from "@/app/actions/tasks";
import { scheduleSchema, TASK_FILE_ACCEPT } from "@/lib/schemas-tasks";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { DateField } from "@/components/forms/date-fields";
import { Form, SubmitButton, TextField } from "@/components/forms/form";
import { uploadTaskFile } from "@/components/tasks/upload";
import { btn, cn } from "@/components/ui";

/** Tarih / saat ver (Planla). */
export function ScheduleForm({ id, date, time }: { id: string; date: string | null; time: string | null }) {
  return (
    <Form
      schema={scheduleSchema}
      defaultValues={{ id, planned_date: date ?? "", planned_time: time?.slice(0, 5) ?? "" }}
      action={scheduleTask}
      resetOnSuccess={false}
      className="space-y-3"
    >
      <div className="grid grid-cols-[1fr_7.5rem] gap-3">
        <DateField name="planned_date" label="Tarih" clearable />
        <TextField name="planned_time" type="time" label="Saat" />
      </div>
      <SubmitButton variant="secondary">
        <CalendarClock className="size-4" aria-hidden /> {date ? "Tarihi güncelle" : "Tarih ve saati kaydet"}
      </SubmitButton>
    </Form>
  );
}

function OpButton({ op, children, className }: { op: string; children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button name="op" value={op} disabled={pending} className={className}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** Görev sayfasındaki durum düğmeleri (duruma göre görünür). */
export function TaskStatusButtons({ id, status, title }: { id: string; status: string; title: string }) {
  const open = ["pending", "issue", "accepted"].includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {open && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={id} />
          <OpButton op="complete" className={btn("primary", "md", "bg-success hover:brightness-110")}>
            <CheckCheck className="size-4" aria-hidden /> Tamamlandı
          </OpButton>
        </form>
      )}
      {(status === "issue" || status === "accepted") && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={id} />
          <OpButton op="resend" className={btn("secondary", "md")}>
            <Send className="size-4" aria-hidden /> Yeniden onaya gönder
          </OpButton>
        </form>
      )}
      {(status === "done" || status === "cancelled") && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={id} />
          <OpButton op="reopen" className={btn("secondary", "md")}>
            <RotateCcw className="size-4" aria-hidden /> Geri al (yeniden aç)
          </OpButton>
        </form>
      )}
      {open && (
        <form action={setTaskStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value="cancel" />
          <ConfirmSubmit
            title={`“${title}” görevi iptal edilsin mi?`}
            description="Görev personelin listesinden kalkar; kayıt ve geçmişi silinmez. İsterseniz sonra geri alabilirsiniz."
            confirmLabel="İptal et"
            tone="warning"
            icon={<XCircle className="size-4" aria-hidden />}
            className={btn("ghost", "md")}
          >
            Görevi iptal et
          </ConfirmSubmit>
        </form>
      )}
      <form action={deleteTask}>
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmit
          title={`“${title}” görevi silinsin mi?`}
          description="Görev, geçmişi ve eklenen dosyalar kalıcı olarak silinir. Yalnızca yanlış açılan görevler için kullanın; diğerlerini iptal edin."
          confirmLabel="Kalıcı olarak sil"
          icon={<Trash2 className="size-4" aria-hidden />}
          className={btn("danger", "md")}
        >
          Sil
        </ConfirmSubmit>
      </form>
    </div>
  );
}

/** Göreve dosya ekle (müdür). */
export function AddTaskFiles({ id, label = "Fotoğraf / belge ekle" }: { id: string; label?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input
        ref={input}
        type="file"
        multiple
        accept={TASK_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const list = Array.from(e.target.files ?? []);
          if (input.current) input.current.value = "";
          if (!list.length) return;
          setBusy(true);
          setError(null);
          const failed: string[] = [];
          for (const f of list) {
            try {
              await uploadTaskFile(id, f);
            } catch (err) {
              failed.push(err instanceof Error ? err.message : f.name);
            }
          }
          setBusy(false);
          if (failed.length) setError(failed.join(" · "));
          router.refresh();
        }}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={cn(btn("secondary", "sm"))}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
        {busy ? "Yükleniyor…" : label}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
