import { Tabs } from "@/components/tabs";

/** Denetimler alt sekmeleri; "Yeni denetim ekle" yalnızca belge yöneticisi (merkez) için, müşteri görmez. */
export function InspectionTabs({ manage }: { manage: boolean }) {
  if (!manage) return null;
  return <Tabs items={[{ href: "/denetimler", label: "Denetimler", exact: true }, { href: "/denetimler/ekle", label: "Yeni denetim ekle" }]} />;
}
