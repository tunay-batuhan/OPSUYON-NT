import type { ReactNode } from "react";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { sectionPages } from "@/lib/menu";

/** Cari Hesap: sabit başlık + sekmeler (Cari Ekstre / Faturalar); sekme değişince yalnızca içerik yüklenir. */
export default async function LedgerLayout({ children }: { children: ReactNode }) {
  const [user, on] = await Promise.all([getCurrentUser(), getEnabledModules()]);
  return (
    <>
      <SectionHeader
        title="Cari Hesap"
        tabs={user ? sectionPages("cari", user, on) : []}
        descriptions={{
          "/cari-hesap": "Son yüklenen cari ekstre ve güncel bakiye. Ekstreyi PDF olarak indirebilirsiniz.",
          "/cari-hesap/faturalar": "Ay ve yıl seçin; o döneme ait faturayı PDF olarak indirin.",
        }}
      />
      {children}
    </>
  );
}
