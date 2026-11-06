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
          "/devriye/okut": "Barkod Okut: devriyede her noktada barkodu okutun; rapor otomatik oluşur.",
          "/devriye/rapor": "Gün, ay ve yıl seçin; o günün devriye raporu okutma kayıtlarından otomatik oluşur. PDF olarak indirebilirsiniz.",
          "/devriye/noktalar": "Noktalar ve Etiketler: her nokta için barkod/QR etiketi yazdırıp noktaya yapıştırın; görevli telefonundan okutur.",
          "/devriye/noktalar/ekle": "Yeni nokta: barkod içeriği otomatik üretilir. Ekledikten sonra Noktalar ve Etiketler sekmesinden etiketini yazdırın.",
        }}
      >
        <DemoNotice />
      </SectionHeader>
      {children}
    </>
  );
}
