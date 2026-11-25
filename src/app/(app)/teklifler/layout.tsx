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
          "/teklifler/yeni": "1. adım: müşteri ve bugün satın aldığı hizmetler; bu haliyle kaydedip gönderebilirsiniz. 2. adım isteğe bağlı: maliyet karşılaştırma (OPSUYON tutarı, KDV, şirket kâr payı ve maliyet kalemleri). Tablette kullanmak için tasarlandı.",
          "/teklifler/ayarlar": "Yeni tekliflerin varsayılanları (kişi başı tutar, KDV, şirket kâr payı, hizmet satırları), maliyet tablosu oranları ve teklif PDF'inin antetli kağıdı.",
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
