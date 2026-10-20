"use client";

import { createPatrolPoint } from "@/app/actions/patrol";
import { patrolPointSchema } from "@/lib/schemas";
import { Form, FormGrid, SelectField, SubmitButton, TextField } from "@/components/forms/form";

type Option = { value: string; label: string };

/** Merkez: projeye devriye noktası ekler (barkod içeriği otomatik üretilir). */
export function PatrolPointForm({ projects, defaultProject }: { projects: Option[]; defaultProject?: string }) {
  return (
    <Form schema={patrolPointSchema} defaultValues={{ project_id: defaultProject ?? "", name: "" }} action={createPatrolPoint} className="space-y-4 p-5">
      <FormGrid cols={2}>
        <SelectField name="project_id" label="Proje" options={projects} required />
        <TextField name="name" label="Nokta adı" required placeholder="Örn. A Blok Girişi" />
      </FormGrid>
      <SubmitButton>Noktayı ekle</SubmitButton>
    </Form>
  );
}
