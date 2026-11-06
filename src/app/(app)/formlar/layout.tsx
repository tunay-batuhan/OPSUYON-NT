import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { canAnywhere, getCurrentUser } from "@/lib/auth";

/** Formlar: sabit başlık + sekmeler (Form listesi / Form ekle); sekme değişince yalnızca içerik yüklenir. */
export default async function FormsLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const manage = Boolean(user && user.kind === "staff" && canAnywhere(user, "documents.manage"));
  return (
    <>
      <SectionHeader
        title="Formlar"
        description="İzin, kıyafet teslim, savunma gibi form şablonları. Arama kutusuna birkaç harf yazarak formu bulun."
        descriptions={{ "/formlar/ekle": "Eklenen form, formları görme yetkisi olan tüm müşterilerde listelenir." }}
        tabs={manage ? [{ href: "/formlar", label: "Form listesi", exact: true }, { href: "/formlar/ekle", label: "Form ekle" }] : []}
      />
      {children}
    </>
  );
}
