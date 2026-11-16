import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/section-header";
import { hasPermission, requireStaff } from "@/lib/auth";

/**
 * Teklifler (yalnızca merkez, satış): sabit başlık + sekmeler (Teklifler / Yeni teklif / Ayarlar);
 * sekme değişince yalnızca içerik yüklenir.
 */
export default async function OffersLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  const manage = hasPermission(user, "offers.manage");
  if (!manage && !hasPermission(user, "offers.read")) redirect("/merkez?yetki=yok");
  return (
    <>
      <SectionHeader
        title="Teklifler"
        description="Müşteriye verilen teklifler ve teklif raporu. Bir teklife tıklayınca hesap tablosu, PDF ve durum açılır."
        descriptions={{
          "/teklifler/yeni": "Müşterinin bugün aldığı hizmetleri ve aylık tutarlarını girin; kâr tablosu yazdıkça güncellenir. Tablette kullanmak için tasarlandı.",
          "/teklifler/ayarlar": "Yeni tekliflerin varsayılan kişi başı tutarı, KDV oranı, geçerlilik süresi ve hizmet satırları.",
        }}
        tabs={
          manage
            ? [
                { href: "/teklifler", label: "Teklifler", exact: true },
                { href: "/teklifler/yeni", label: "Yeni teklif" },
                { href: "/teklifler/ayarlar", label: "Ayarlar" },
              ]
            : []
        }
      />
      {children}
    </>
  );
}
