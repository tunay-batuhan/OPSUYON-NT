import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { payrollPages } from "@/lib/menu";

/**
 * Bordrolar: sabit başlık + sekmeler (yüklenen bordrolar; merkezde bordro ekle). Puantaj ile aynı düzen: bordro
 * dışarıda (Excel / PDF) hazırlanır, proje ve dönem seçilip yüklenir. Sekmeler yetkiye göre (lib/menu.ts → payrollPages).
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
            ? "Bordrolar hizmet bazında toplu olarak yüklenir. Hizmet, ay ve yılı seçin; bordroyu indirin veya altta görüntüleyin."
            : "Tüm projelerin aylık bordroları. İndirebilir, Görüntüle ile açabilir veya silebilirsiniz."
        }
        descriptions={{
          "/bordrolar/ekle": "Proje, ay ve yıl seçip bordro dosyasını (Excel ya da PDF) ekleyin; işaretliyse müşteri Bordrolar ekranında görür.",
        }}
        tabs={tabs}
      />
      {children}
    </>
  );
}
