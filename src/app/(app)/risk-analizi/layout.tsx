import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser, hasPermission } from "@/lib/auth";

/** Risk Analizi: sabit başlık + sekmeler (Risk analizleri / Risk analizi ekle); sekme değişince yalnızca içerik yüklenir. */
export default async function RiskLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const manage = Boolean(user && hasPermission(user, "documents.manage"));
  return (
    <>
      <SectionHeader
        title="Risk Analizi"
        description={
          user?.kind === "customer"
            ? "Merkez tarafından hazırlanıp yüklenen risk analizi raporları. PDF olarak indirebilirsiniz."
            : "Tüm projelerin risk analizi raporları. İndirebilir, Görüntüle ile açabilir veya silebilirsiniz."
        }
        descriptions={{ "/risk-analizi/ekle": "Proje, ay ve yıl seçip risk analizi raporunu ekleyin; işaretliyse müşteri Risk Analizi ekranında görür." }}
        tabs={manage ? [{ href: "/risk-analizi", label: "Risk analizleri", exact: true }, { href: "/risk-analizi/ekle", label: "Risk analizi ekle" }] : []}
      />
      {children}
    </>
  );
}
