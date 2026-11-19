import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser, hasPermission } from "@/lib/auth";

/** İzin Yönetimi: sabit başlık + sekmeler (İzin kayıtları / İzin evrakı ekle); sekme değişince yalnızca içerik yüklenir. */
export default async function LeavesLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const manage = Boolean(user && user.kind === "staff" && hasPermission(user, "leaves.manage"));
  return (
    <>
      <SectionHeader
        title="İzin Yönetimi"
        description="Personelin izin kayıtları, kalan yıllık izin süresi ve izin evrakları."
        tabs={manage ? [{ href: "/izinler", label: "İzin kayıtları", exact: true }, { href: "/izinler/ekle", label: "İzin evrakı ekle" }] : []}
      />
      {children}
    </>
  );
}
