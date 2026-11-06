import { Tabs } from "@/components/tabs";

/** İzin Yönetimi alt sekmeleri; yalnızca izin yöneticisi (merkez) görür. */
export function LeaveTabs({ manage }: { manage: boolean }) {
  if (!manage) return null;
  return <Tabs items={[{ href: "/izinler", label: "İzin kayıtları", exact: true }, { href: "/izinler/ekle", label: "İzin evrakı ekle" }]} />;
}
