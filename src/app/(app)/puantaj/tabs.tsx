import { Tabs } from "@/components/tabs";

/** Puantaj alt sekmeleri; "Puantaj ekle" yalnızca belge yöneticisi (merkez) için. */
export function TimesheetTabs({ manage }: { manage: boolean }) {
  if (!manage) return null;
  return <Tabs items={[{ href: "/puantaj", label: "Puantajlar", exact: true }, { href: "/puantaj/ekle", label: "Puantaj ekle" }]} />;
}
