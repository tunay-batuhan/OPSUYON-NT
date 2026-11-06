import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { FormTemplateUpload } from "@/components/forms/form-template-upload";
import { canAnywhere } from "@/lib/auth";
import { requireAccess } from "@/lib/modules";
import { FormsTabs } from "../tabs";

export const metadata: Metadata = { title: "Form ekle" };

export default async function FormAddPage() {
  const user = await requireAccess("formlar", "forms.read");
  const manage = user.kind === "staff" && canAnywhere(user, "documents.manage");
  if (!manage) notFound();
  return (
    <>
      <PageHeader title="Formlar" description="Eklenen form, formları görme yetkisi olan tüm müşterilerde listelenir." />
      <FormsTabs manage />
      <Card>
        <CardHeader title="Form ekle" description="Form şablonunu (PDF, Word, Excel) seçin; başlık ve açıklama yazıp kaydedin." />
        <FormTemplateUpload />
      </Card>
    </>
  );
}
