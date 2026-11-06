import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import type { TabItem } from "@/components/tabs";
import { hasPermission, requireStaff } from "@/lib/auth";

/** Kullanıcılar & hesaplar: sabit başlık + sekmeler (Hesaplar · Müşteri hesabı aç · Merkez personeli ekle). Kullanıcı detayı bu grubun dışında. */
export default async function UsersLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff("users.read");
  const tabs: TabItem[] = [{ href: "/merkez/kullanicilar", label: "Hesaplar", exact: true }];
  if (hasPermission(user, "users.manage")) {
    tabs.push({ href: "/merkez/kullanicilar/musteri-ekle", label: "Müşteri hesabı aç" });
    if (user.roleCode === "super_admin") tabs.push({ href: "/merkez/kullanicilar/merkez-ekle", label: "Merkez personeli ekle" });
  }
  return (
    <>
      <SectionHeader
        title="Kullanıcılar & hesaplar"
        description="Firmaları ve hesapları yalnızca merkez tanımlar. Müşteri, kendisine tanımlanan kullanıcı adı ve parola ile aynı giriş ekranından girer; yetkisi olan ekranlar otomatik açılır."
        tabs={tabs}
      />
      {children}
    </>
  );
}
