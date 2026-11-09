import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { sectionPages } from "@/lib/menu";

/** Devriye Sistemi: sabit başlık + sekmeler; sekme değişince yalnızca içerik yüklenir. Etiket yazdırma sayfası bu grubun dışında. */
export default async function PatrolSectionLayout({ children }: { children: ReactNode }) {
  const [user, on] = await Promise.all([getCurrentUser(), getEnabledModules()]);
  return (
    <>
      <SectionHeader
        title="Devriye Sistemi"
        tabs={user ? sectionPages("devriye", user, on) : []}
        descriptions={{
          "/devriye/rapor": "Görevliler noktadaki QR'ı telefonuyla okutur, proje PIN'ini girip listeden adını seçer; kayıtlar burada saniyesiyle listelenir. Tarih aralığı seçebilirsiniz; kayıtlar 1 ay saklanır, günlük raporu PDF olarak indirebilirsiniz.",
          "/devriye/noktalar": "Bir projeyi açın: noktalarını adlarıyla ekleyin, sıralayın, QR etiketlerini yazdırıp noktalara yapıştırın ve projeye 4 haneli PIN verin.",
        }}
      />
      {children}
    </>
  );
}
