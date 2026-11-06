import { PageHeader } from "@/components/ui";
import { Tabs, type TabItem } from "@/components/tabs";
import { hasPermission, type CurrentUser } from "@/lib/auth";

/** Personel listesi / Personel ekle / Evrak ekle alt sekmeleri (yetkiye göre). */
export function PersonnelHeader({ user, description }: { user: CurrentUser; description?: string }) {
  const tabs: TabItem[] = [{ href: "/merkez/personel", label: "Personel listesi", exact: true }];
  if (hasPermission(user, "personnel.manage")) tabs.push({ href: "/merkez/personel/ekle", label: "Personel ekle" });
  if (hasPermission(user, "documents.manage")) tabs.push({ href: "/merkez/personel/evrak-ekle", label: "Evrak ekle" });
  return (
    <>
      <PageHeader title="Personel" description={description} />
      <Tabs items={tabs} />
    </>
  );
}
