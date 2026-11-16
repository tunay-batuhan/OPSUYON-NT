import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { payrollPages } from "@/lib/menu";

/**
 * Bordrolar: sabit başlık + sekmeler (yüklenen bordrolar, maaş hesaplama, avanslar, ücret tanımları; merkezde
 * bordro ekle). Sekmeler yetkiye göre (lib/menu.ts → payrollPages); sekme değişince yalnızca içerik yüklenir.
 */
export default async function PayrollLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const customer = user?.kind === "customer";
  const tabs = user ? payrollPages(user) : [];
  return (
    <>
      <SectionHeader
        title="Bordrolar"
        description={
          customer
            ? "Bordrolar hizmet bazında toplu olarak yüklenir. Hizmet, ay ve yılı seçin; bordroyu PDF olarak indirin veya altta görüntüleyin."
            : "Tüm projelerin aylık bordroları. İndirebilir, Görüntüle ile açabilir veya silebilirsiniz."
        }
        descriptions={{
          "/bordrolar/ekle": "Proje, ay ve yıl seçip bordro dosyasını ekleyin; işaretliyse müşteri Bordrolar ekranında görür.",
          "/bordrolar/maas":
            "Proje ve ayı seçin; eksik gün, fazla mesai ve yemek gününü girip “Kaydet ve hesapla”ya basın. Tutarlar ücret tanımlarından ve avanslardan hesaplanır. Onaylanan bordro kilitlenir ve personel telefonundan görür.",
          "/bordrolar/avans": "Ay içinde personele verilen avansları girin; o ayın maaşından otomatik düşülür.",
          "/bordrolar/ucretler": customer
            ? "Personelin net maaş, yol, fazla mesai, yemek kartı ve ek ödeme tutarları. Ücret tanımlarını merkez girer."
            : "Personel başına net tutarlar: maaş, aylık yol, günlük fazla mesai, günlük yemek kartı ve ek ödeme. Müşteri görür, değiştiremez.",
        }}
        tabs={tabs}
      />
      {children}
    </>
  );
}
