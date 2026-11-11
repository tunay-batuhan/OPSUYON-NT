"use client";

import { addHoliday } from "@/app/actions/leaves";
import { holidaySchema } from "@/lib/schemas-ops";
import { CheckboxField, Form, FormGrid, SubmitButton, TextField } from "@/components/forms/form";
import { DateField } from "@/components/forms/date-fields";

/** Resmi tatil ekle: tarih + ad; arife gibi öğleden sonra başlayan tatiller "yarım gün" işaretlenir. */
export function HolidayForm() {
  return (
    <Form schema={holidaySchema} defaultValues={{ day: "", name: "", half: false }} action={addHoliday} className="space-y-4 p-5">
      <FormGrid cols={6}>
        <DateField name="day" label="Tarih" required className="sm:col-span-2" />
        <TextField name="name" label="Tatilin adı" required maxLength={80} placeholder="Örn. Ramazan Bayramı 1. gün" className="sm:col-span-4" />
        <CheckboxField
          name="half" label="Yarım gün (arife gibi öğleden sonra başlayan tatil)"
          hint="Yarım gün tatil, izinden 0,5 gün olarak sayılır; tam gün tatil hiç sayılmaz."
          className="sm:col-span-6"
        />
      </FormGrid>
      <SubmitButton>Tatili ekle</SubmitButton>
    </Form>
  );
}
