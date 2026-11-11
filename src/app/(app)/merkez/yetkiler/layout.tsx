import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";

/**
 * Roller ve yetkiler: tek yerde hesap türleri, roller (merkez / müşteri) ve müşteri panelinin ekranları.
 * Başlık + sekmeler sabit; sekme değişince yalnızca içerik yüklenir. Erişim denetimi her sayfada yapılır.
 */
export default function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHeader
        title="Roller ve yetkiler"
        tabs={[
          { href: "/merkez/yetkiler", label: "Genel bakış", exact: true },
          { href: "/merkez/yetkiler/merkez-rolleri", label: "Merkez rolleri" },
          { href: "/merkez/yetkiler/musteri-rolleri", label: "Müşteri rolleri" },
          { href: "/merkez/yetkiler/musteri-ekranlari", label: "Müşteri ekranları" },
        ]}
        descriptions={{
          "/merkez/yetkiler": "Kim neyi görür, neyi değiştirebilir? Roller birer yetki paketidir; buradan tanımlanır ve hesaplara verilir.",
          "/merkez/yetkiler/merkez-rolleri": "Merkez çalışanlarının rolleri. Yeni rol açabilir, rollerin yetkilerini seçebilirsiniz.",
          "/merkez/yetkiler/musteri-rolleri": "Müşteri hesaplarının rolleri. Hesaba proje bazında verilir; yalnızca görme yetkileri içerir.",
          "/merkez/yetkiler/musteri-ekranlari": "Müşteri panelinde hangi ekranların bulunduğu: tüm müşteriler için tek açma/kapama. Merkez tarafı etkilenmez.",
        }}
      />
      {children}
    </>
  );
}
