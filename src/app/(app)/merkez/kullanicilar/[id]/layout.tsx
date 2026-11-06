import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { Tabs, type TabItem } from "@/components/tabs";
import { loadUserDetail } from "./data";

/**
 * Kullanıcı detayı: başlık + sekmeler (her sekme tek iş).
 *   Merkez kullanıcısı: Hesap · Kişiye özel yetkiler
 *   Müşteri kullanıcısı: Hesap · Proje erişimleri · Projeye erişim ver
 */
export default async function UserDetailLayout({ params, children }: LayoutProps<"/merkez/kullanicilar/[id]">) {
  const { id } = await params;
  const { u, manage, members, staffOverrides } = await loadUserDetail(id);
  const base = `/merkez/kullanicilar/${u.id}`;
  const tabs: TabItem[] = [{ href: base, label: "Hesap", exact: true }];
  if (u.kind === "staff") tabs.push({ href: `${base}/yetkiler`, label: `Kişiye özel yetkiler${staffOverrides.size ? ` (${staffOverrides.size})` : ""}` });
  if (u.kind === "customer") {
    tabs.push({ href: `${base}/erisim`, label: `Proje erişimleri (${members.length})` });
    if (manage) tabs.push({ href: `${base}/erisim-ver`, label: "Projeye erişim ver" });
  }

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/merkez/kullanicilar" className="inline-flex items-center gap-1 hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Kullanıcılar</Link>}
        title={u.full_name}
        description={`@${u.username} · ${u.kind === "staff" ? (u.roles?.name ?? "Merkez") : (u.organizations?.name ?? "Müşteri")}`}
        actions={<Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Aktif" : "Kısıtlı"}</Badge>}
      />
      <Tabs items={tabs} />
      {children}
    </>
  );
}
