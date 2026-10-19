import type { CurrentUser } from "@/lib/auth";
import type { NavItem } from "@/components/nav";

/** Soran kişiye özel bağlam: kim olduğu ve menüde GERÇEKTEN ne gördüğü (modül ve yetkiye göre değişir). */
export function userContext(user: CurrentUser, items: NavItem[], path: string): string {
  const menu = items
    .map((i) => {
      const sub = i.children?.length ? ` (alt menü: ${i.children.map((c) => c.label).join(", ")})` : "";
      return `- ${i.label}${sub}${i.group ? ` [${i.group}]` : ""}`;
    })
    .join("\n");

  const who =
    user.kind === "staff"
      ? `Merkez (yönetim) personeli — rol: ${user.roleName ?? "Merkez"}`
      : "Müşteri (firma) kullanıcısı";

  return [
    "# KULLANICI BAĞLAMI",
    `Hesap türü: ${who}`,
    `Adı: ${user.full_name}`,
    `SAYFA (şu an bulunduğu ekranın yolu, kullanıcıya adres olarak söyleme): ${path || "bilinmiyor"}`,
    "Bu kişinin sol menüsünde GÖRDÜĞÜ ekranlar (başka ekran tarif etme):",
    menu,
    "(Alt menüler, başlığın sağındaki oka tıklayınca açılır.)",
  ].join("\n");
}
