"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { createAdvance, deleteAdvance } from "@/app/actions/payroll";
import { advanceSchema, type AdvanceValues } from "@/lib/schemas-payroll";
import { Form, FormGrid, SelectField, SubmitButton, TextField } from "@/components/forms/form";
import { DateField } from "@/components/forms/date-fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useRouter } from "next/navigation";
import { ActionResult } from "./action-result";
import { useAction } from "./use-action";

type Option = { value: string; label: string };
type PersonOption = Option & { project_id: string };

function Fields({ projects, people }: { projects: Option[]; people: PersonOption[] }) {
  const { control, setValue } = useFormContext<AdvanceValues>();
  const projectId = useWatch({ control, name: "project_id" });
  const options = people.filter((p) => p.project_id === projectId);
  return (
    <FormGrid cols={6}>
      <SelectField
        name="project_id" label="Proje" required options={projects} className="sm:col-span-3"
        onValueChange={() => setValue("personnel_id", "")}
      />
      <SelectField
        key={projectId} name="personnel_id" label="Personel" required searchable options={options} className="sm:col-span-3"
        hint={projectId && options.length === 0 ? "Bu projede görevli personel yok." : undefined}
      />
      <DateField name="paid_on" label="Ödeme tarihi" required className="sm:col-span-2" hint="Avans bu tarihin ayındaki maaştan düşülür." />
      <TextField name="amount" label="Tutar" required inputMode="decimal" suffix="₺" placeholder="0,00" className="sm:col-span-2" hint="Kuruş için virgül (ör. 2.500,50)" />
      <TextField name="note" label="Açıklama" maxLength={300} placeholder="İsteğe bağlı" className="sm:col-span-2" />
    </FormGrid>
  );
}

/** Avans girişi: proje → o projede görevli personel, ödeme tarihi, tutar, açıklama. */
export function AdvanceForm({ projects, people, today, defaultProject }: { projects: Option[]; people: PersonOption[]; today: string; defaultProject?: string }) {
  const router = useRouter();
  return (
    <Form<AdvanceValues>
      schema={advanceSchema}
      defaultValues={{ project_id: defaultProject ?? (projects.length === 1 ? projects[0].value : ""), personnel_id: "", paid_on: today, amount: "", note: "" }}
      action={createAdvance}
      onSuccess={() => router.refresh()}
      className="space-y-4 p-5"
    >
      <Fields projects={projects} people={people} />
      <SubmitButton>Avansı kaydet</SubmitButton>
    </Form>
  );
}

/** Satırdaki "Sil" (onaylı / kilitli ayda veritabanı reddeder; hata satırda gösterilir). */
export function DeleteAdvanceButton({ id, label }: { id: string; label: string }) {
  const { pending, result, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <ConfirmDialog title="Avans silinsin mi?" items={[label]} description="Kayıt silinir; o ayın taslak bordrosu yeniden hesaplanır." onConfirm={() => run(() => deleteAdvance(id))}>
        <button type="button" disabled={pending} className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Avansı sil: ${label}`}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      </ConfirmDialog>
      {result?.error && <ActionResult result={result} className="max-w-xs text-xs" />}
    </span>
  );
}
