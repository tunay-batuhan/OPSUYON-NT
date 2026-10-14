"use client";

import { upsertLeaveBalance, upsertTimesheet } from "@/app/actions/personnel";
import { createThread, sendMessage } from "@/app/actions/messages";
import { leaveSchema, messageSchema, threadSchema, timesheetSchema } from "@/lib/schemas";
import { MONTHS } from "@/lib/format";
import { Form, FormGrid, SelectField, SubmitButton, TextField, TextareaField } from "@/components/forms/form";

type Option = { value: string; label: string };

export function TimesheetForm({ projectId, year, month, people }: { projectId: string; year: number; month: number; people: Option[] }) {
  return (
    <Form
      schema={timesheetSchema}
      defaultValues={{
        project_id: projectId, personnel_id: "", period_year: String(year), period_month: String(month),
        worked_days: "", leave_days: "", absence_days: "", overtime_hours: "", note: "",
      }}
      action={upsertTimesheet}
      className="space-y-4 p-5"
    >
      <FormGrid cols={6}>
        <SelectField name="personnel_id" label="Personel" options={people} required className="sm:col-span-2" />
        <TextField name="worked_days" label="Çalışılan gün" inputMode="decimal" placeholder="0" suffix="gün" />
        <TextField name="leave_days" label="İzin" inputMode="decimal" placeholder="0" suffix="gün" />
        <TextField name="absence_days" label="Devamsızlık" inputMode="decimal" placeholder="0" suffix="gün" />
        <TextField name="overtime_hours" label="Fazla mesai" inputMode="decimal" placeholder="0" suffix="sa" />
        <TextField name="note" label="Not" className="sm:col-span-6" />
      </FormGrid>
      <p className="text-xs text-muted">Dönem: {MONTHS[month - 1]} {year}. Aynı personel ve dönem için kayıt varsa güncellenir.</p>
      <SubmitButton>Kaydet</SubmitButton>
    </Form>
  );
}

export function LeaveForm({ projectId, year, people }: { projectId: string; year: number; people: Option[] }) {
  return (
    <Form
      schema={leaveSchema}
      defaultValues={{ project_id: projectId, personnel_id: "", year: String(year), entitled_days: "", carried_days: "", used_days: "" }}
      action={upsertLeaveBalance}
      className="space-y-4 p-5"
    >
      <FormGrid cols={6}>
        <SelectField name="personnel_id" label="Personel" options={people} required className="sm:col-span-2" />
        <TextField name="entitled_days" label="Hak edilen" inputMode="decimal" suffix="gün" />
        <TextField name="carried_days" label="Devreden" inputMode="decimal" suffix="gün" />
        <TextField name="used_days" label="Kullanılan" inputMode="decimal" suffix="gün" />
      </FormGrid>
      <SubmitButton>Kaydet</SubmitButton>
    </Form>
  );
}

export function ThreadForm({ projects, defaultProject }: { projects: Option[]; defaultProject?: string }) {
  return (
    <Form schema={threadSchema} defaultValues={{ project_id: defaultProject ?? "", subject: "", body: "" }} action={createThread} className="space-y-4 p-5">
      <SelectField name="project_id" label="Proje" options={projects} required />
      <TextField name="subject" label="Konu" required maxLength={140} />
      <TextareaField name="body" label="Mesaj" required rows={4} />
      <SubmitButton className="w-full">Gönder</SubmitButton>
    </Form>
  );
}

export function MessageForm({ threadId }: { threadId: string }) {
  return (
    <Form schema={messageSchema} defaultValues={{ thread_id: threadId, body: "" }} action={sendMessage} className="space-y-3 border-t border-border p-5">
      <TextareaField name="body" label="Yanıtınız" required rows={3} />
      <SubmitButton>Gönder</SubmitButton>
    </Form>
  );
}
