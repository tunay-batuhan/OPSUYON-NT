import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { DemoNotice } from "@/components/demo-notice";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { sectionPages } from "@/lib/menu";

/** Devriye Sistemi (demo): sabit başlık + sekmeler; sekme değişince yalnızca içerik yüklenir. Etiket yazdırma sayfası bu grubun dışında. */
export default async function PatrolSectionLayout({ children }: { children: ReactNode }) {
  const [user, on] = await Promise.all([getCurrentUser(), getEnabledModules()]);
  return (
    <>
      <SectionHeader
        title="Devriye Sistemi"
        tabs={user ? sectionPages("devriye", user, on) : []}
        descriptions={{
          "/devriye/rapor": "Görevliler noktadaki QR'ı telefonuyla okutur, proje PIN'ini girip listeden adını seçer; kayıtlar burada saniyesiyle listelenir. Kayıtlar 1 ay saklanır; günlük raporu PDF olarak indirebilirsiniz.",
          "/devriye/noktalar": "Noktalar ve Etiketler: her nokta için QR etiketi yazdırıp noktaya yapıştırın; görevli telefonunun kamerasıyla okutur.",
          "/devriye/noktalar/ekle": "Yeni nokta: QR içeriği otomatik üretilir. Ekledikten sonra Noktalar ve Etiketler sekmesinden etiketini yazdırın.",
          "/devriye/pinler": "Her projeye 4 haneli bir PIN verin ve görevlilerle paylaşın. Görevli QR'ı okutup PIN'i girer, ardından projenin personel listesinden kendi adını seçer.",
        }}
      >
        <DemoNotice />
      </SectionHeader>
      {children}
    </>
  );
}
