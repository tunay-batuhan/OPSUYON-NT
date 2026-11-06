import { Tabs, type TabItem } from "@/components/tabs";
import { PageHeader } from "@/components/ui";
import { hasPermission, requireStaff } from "@/lib/auth";

/** Projeler: üstte alt sekmeler (Proje listesi / Proje ekle). */
export default async function MerkezProjectsLayout({ children }: LayoutProps<"/merkez/projeler">) {
  const user = await requireStaff("projects.read");
  const tabs: TabItem[] = [{ href: "/merkez/projeler", label: "Proje listesi", exact: true }];
  if (hasPermission(user, "projects.manage")) tabs.push({ href: "/merkez/projeler/ekle", label: "Proje ekle" });

  return (
    <>
      <PageHeader title="Projeler" description="Her proje bir firmaya ve bir hizmet alanına bağlıdır." />
      <Tabs items={tabs} />
      {children}
    </>
  );
}
