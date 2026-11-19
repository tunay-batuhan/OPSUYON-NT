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
          "/teklifler/yeni": "Müşterinin bugün aldığı hizmetleri, kişi sayısını ve kişi başı bedeli girin; kazanç (KDV farkı + şirket kâr payı) yazdıkça güncellenir. Tablette kullanmak için tasarlandı.",
          "/teklifler/maliyet": "Maliyet tablosu: brüt maaş, yol, giderler ve şirket kâr payından kişi başı bedeli hesaplayın; bugünkü maliyetle OPSUYON'u karşılaştırın. Brütten nete maaş hesabı da buradadır.",
          "/teklifler/ayarlar": "Yeni tekliflerin varsayılanları (kişi başı tutar, KDV, şirket kâr payı, hizmet satırları), maliyet tablosu oranları ve teklif PDF'inin antetli kağıdı.",
        }}
        tabs={
          manage
            ? [
                { href: "/teklifler", label: "Teklifler", exact: true },
                { href: "/teklifler/yeni", label: "Yeni teklif" },
                { href: "/teklifler/maliyet", label: "Maliyet karşılaştırma" },
                { href: "/teklifler/ayarlar", label: "Ayarlar" },
              ]
            : []
        }
      />
      {children}
    </>
  );
}
