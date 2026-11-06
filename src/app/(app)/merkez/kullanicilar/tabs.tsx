import { PageHeader } from "@/components/ui";
import { Tabs, type TabItem } from "@/components/tabs";
import { hasPermission, type CurrentUser } from "@/lib/auth";

/** Kullanıcılar & hesaplar: Hesaplar / Müşteri hesabı aç / Merkez personeli ekle sekmeleri (her sekme tek iş). */
export function UsersHeader({ user }: { user: CurrentUser }) {
  const tabs: TabItem[] = [{ href: "/merkez/kullanicilar", label: "Hesaplar", exact: true }];
  if (hasPermission(user, "users.manage")) {
    tabs.push({ href: "/merkez/kullanicilar/musteri-ekle", label: "Müşteri hesabı aç" });
    if (user.roleCode === "super_admin") tabs.push({ href: "/merkez/kullanicilar/merkez-ekle", label: "Merkez personeli ekle" });
  }
  return (
    <>
      <PageHeader
        title="Kullanıcılar & hesaplar"
        description="Firmaları ve hesapları yalnızca merkez tanımlar. Müşteri, kendisine tanımlanan kullanıcı adı ve parola ile aynı giriş ekranından girer; yetkisi olan ekranlar otomatik açılır."
      />
      {tabs.length > 1 && <Tabs items={tabs} />}
    </>
  );
}
