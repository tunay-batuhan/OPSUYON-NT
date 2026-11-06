import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser, hasPermission } from "@/lib/auth";

/** Denetimler: sabit başlık + sekmeler (Denetimler / Yeni denetim ekle); sekme değişince yalnızca içerik yüklenir. */
export default async function InspectionsLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const manage = Boolean(user && user.kind === "staff" && hasPermission(user, "documents.manage"));
  return (
    <>
      <SectionHeader
        title="Denetimler"
        description="Yapılan denetimlerin raporları."
        tabs={manage ? [{ href: "/denetimler", label: "Denetimler", exact: true }, { href: "/denetimler/ekle", label: "Yeni denetim ekle" }] : []}
      />
      {children}
    </>
  );
}
