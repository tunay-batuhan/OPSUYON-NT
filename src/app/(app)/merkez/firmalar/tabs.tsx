import { PageHeader } from "@/components/ui";
import { Tabs, type TabItem } from "@/components/tabs";
import { hasPermission, type CurrentUser } from "@/lib/auth";

/** Firmalar: Firma listesi / Yeni firma ekle sekmeleri (her sekme tek iş). */
export function OrganizationsHeader({ user }: { user: CurrentUser }) {
  const tabs: TabItem[] = [{ href: "/merkez/firmalar", label: "Firma listesi", exact: true }];
  if (hasPermission(user, "organizations.manage")) tabs.push({ href: "/merkez/firmalar/ekle", label: "Yeni firma ekle" });
  return (
    <>
      <PageHeader title="Firmalar" description="Askıya alınan firmanın kullanıcıları sisteme erişemez." />
      {tabs.length > 1 && <Tabs items={tabs} />}
    </>
  );
}
