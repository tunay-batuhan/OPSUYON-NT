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
          "/devriye/rapor": "Görevli devriyeyi “Devriye başlat / bitir” QR'ını okutup proje PIN'ini girerek ve adını seçerek başlatır; ardından noktaları PIN sorulmadan okutur ve aynı QR'la devriyeyi bitirir. Kayıtlar burada saniyesiyle listelenir; tarih aralığı seçebilirsiniz, kayıtlar 1 ay saklanır, raporu PDF olarak indirebilirsiniz.",
          "/devriye/noktalar": "Bir projeyi açın: noktalarını adlarıyla ekleyin, sıralayın, başlat / bitir etiketiyle birlikte QR etiketlerini (A7) yazdırıp yapıştırın ve projeye 4 haneli PIN verin; PIN yalnızca devriye başlatılırken sorulur.",
        }}
      />
      {children}
    </>
  );
}
