import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { OZLUK_SCREEN } from "@/components/personnel-file";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { sectionPages } from "@/lib/menu";

/**
 * Müşteri › Personel: sabit başlık + sekmeler (Tüm Personel · Özlük Evrakları · Yıllık İzinler · Kıyafet ve Ekipman).
 * Sekme değişince yalnızca alttaki içerik yüklenir. Kişi detay sayfaları bu grubun dışında (sekmesiz).
 */
export default async function PersonnelSectionLayout({ children }: { children: ReactNode }) {
  const [user, on] = await Promise.all([getCurrentUser(), getEnabledModules()]);
  return (
    <>
      <SectionHeader
        title="Personel"
        tabs={user ? sectionPages("personel", user, on) : []}
        descriptions={{
          "/personel": "Projelerinizde görevli tüm personel. Kişiye tıklayınca özlük evrakları, eğitimleri, izinleri, kıyafet ve savunmaları tek sayfada açılır.",
          "/personel/ozluk": OZLUK_SCREEN.description,
          "/personel/izinler": "İşe giriş, hak edilen, kullanılan ve kalan izin. Personel adına tıklayınca izin formları açılır.",
          "/personel/kiyafet": "Personel adına tıklayınca kıyafet ve ekipman teslim tutanakları açılır.",
        }}
      />
      {children}
    </>
  );
}
