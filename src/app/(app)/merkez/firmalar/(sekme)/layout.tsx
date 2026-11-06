import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import type { TabItem } from "@/components/tabs";
import { hasPermission, requireStaff } from "@/lib/auth";

/** Firmalar: sabit başlık + sekmeler (Firma listesi · Yeni firma ekle). Firma detayı bu grubun dışında. */
export default async function OrganizationsLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff("organizations.read");
  const tabs: TabItem[] = [{ href: "/merkez/firmalar", label: "Firma listesi", exact: true }];
  if (hasPermission(user, "organizations.manage")) tabs.push({ href: "/merkez/firmalar/ekle", label: "Yeni firma ekle" });
  return (
    <>
      <SectionHeader title="Firmalar" description="Askıya alınan firmanın kullanıcıları sisteme erişemez." tabs={tabs} />
      {children}
    </>
  );
}
