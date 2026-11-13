import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { sectionPages } from "@/lib/menu";

/**
 * Cari Hesap: sabit başlık + sekmeler; sekme değişince yalnızca içerik yüklenir.
 * Merkez: Cari Hesap / Fatura girişi / Tahsilat girişi · Müşteri: Cari Hesap / Faturalar.
 */
export default async function LedgerLayout({ children }: { children: ReactNode }) {
  const [user, on] = await Promise.all([getCurrentUser(), getEnabledModules()]);
  return (
    <>
      <SectionHeader
        title="Cari Hesap"
        tabs={user ? sectionPages("cari", user, on) : []}
        descriptions={{
          "/cari-hesap": "Firma bazında faturalar, tahsilatlar ve bakiye (tüm faturalar − tüm tahsilatlar). Ekli dosyaları görüntüleyin, Rapor al ile ekstre PDF alın.",
          "/cari-hesap/fatura-ekle": "Firmaya fatura girin: tarih, saat, açıklama, genel toplam ve isteğe bağlı fatura dosyası.",
          "/cari-hesap/tahsilat-ekle": "Firmadan yapılan tahsilatı girin: tarih, saat, açıklama, tahsilat tutarı ve isteğe bağlı dekont.",
          "/cari-hesap/faturalar": "Ay ve yıl seçin; o döneme ait faturayı PDF olarak indirin.",
        }}
      />
      {children}
    </>
  );
}
