import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import type { TabItem } from "@/components/tabs";
import { hasPermission, requireStaff } from "@/lib/auth";

/** Merkez › Personel: sabit başlık + sekmeler (Personel listesi · Personel ekle · Evrak ekle). Kişi detayı bu grubun dışında. */
export default async function MerkezPersonnelLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff("personnel.read");
  const tabs: TabItem[] = [{ href: "/merkez/personel", label: "Personel listesi", exact: true }];
  if (hasPermission(user, "personnel.manage")) tabs.push({ href: "/merkez/personel/ekle", label: "Personel ekle" });
  if (hasPermission(user, "documents.manage")) tabs.push({ href: "/merkez/personel/evrak-ekle", label: "Evrak ekle" });
  return (
    <>
      <SectionHeader
        title="Personel"
        tabs={tabs}
        descriptions={{
          "/merkez/personel": "Müşteri firmaların kadrosundaki personel. Projelere atamalar proje sayfasından yapılır.",
          "/merkez/personel/ekle": "Yeni personel kartı. Projeye atama, proje sayfasının Personel sekmesinden yapılır.",
          "/merkez/personel/evrak-ekle": "Personele ait evrak (özlük, sağlık raporu, eğitim belgesi…) yükleyin. Evrak, personelin çalıştığı projeye bağlanır.",
        }}
      />
      {children}
    </>
  );
}
