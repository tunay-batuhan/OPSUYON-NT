import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { FormsLibrary, type FormItem } from "@/components/forms-library";
import { FormTemplateUpload } from "@/components/forms/form-template-upload";
import { canAnywhere } from "@/lib/auth";
import { requireAccess } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Formlar" };

/** Form şablonları (izin talep, kıyafet teslim, savunma…): merkez ekler, müşteriler indirir. */
export default async function FormsPage() {
  const user = await requireAccess("formlar", "forms.read");
  const supabase = await createClient();
  const { data } = await supabase
    .from("form_templates")
    .select("id, title, description, file_name, size_bytes")
    .eq("is_active", true)
    .order("sort_order")
    .order("title");
  const items = (data ?? []) as FormItem[];
  const manage = user.kind === "staff" && canAnywhere(user, "documents.manage");

  return (
    <>
      <PageHeader title="Formlar" description="İzin, kıyafet teslim, savunma gibi form şablonları. Arama kutusuna birkaç harf yazarak formu bulun." />
      <div className="space-y-6">
        <FormsLibrary items={items} manage={manage} />
        {manage && (
          <Card>
            <CardHeader title="Form ekle" description="Eklenen form, formları görme yetkisi olan tüm müşterilerde listelenir." />
            <FormTemplateUpload />
          </Card>
        )}
      </div>
    </>
  );
}
