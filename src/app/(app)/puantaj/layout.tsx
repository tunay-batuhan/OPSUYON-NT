import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser, hasPermission } from "@/lib/auth";

/** Puantaj: sabit başlık + sekmeler (Puantajlar / Puantaj ekle); sekme değişince yalnızca içerik yüklenir. */
export default async function TimesheetsLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const manage = Boolean(user && user.kind === "staff" && hasPermission(user, "documents.manage"));
  return (
    <>
      <SectionHeader
        title="Puantaj"
        description="Tüm projelerin puantaj dosyaları. PDF indirebilir veya indirmeden Görüntüle ile açabilirsiniz."
        descriptions={{ "/puantaj/ekle": "Proje, ay ve yıl seçip puantaj dosyasını ekleyin; müşteri Puantaj ekranında görür." }}
        tabs={manage ? [{ href: "/puantaj", label: "Puantajlar", exact: true }, { href: "/puantaj/ekle", label: "Puantaj ekle" }] : []}
      />
      {children}
    </>
  );
}
