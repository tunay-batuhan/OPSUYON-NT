import { Tabs } from "@/components/tabs";

/** Formlar: Form listesi / Form ekle sekmeleri; Form ekle yalnızca merkezde (belge yöneticisi). */
export function FormsTabs({ manage }: { manage: boolean }) {
  if (!manage) return null;
  return <Tabs items={[{ href: "/formlar", label: "Form listesi", exact: true }, { href: "/formlar/ekle", label: "Form ekle" }]} />;
}
