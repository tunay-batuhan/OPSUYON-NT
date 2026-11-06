"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { Tabs, type TabItem } from "@/components/tabs";

/**
 * Sekmeli bölümün sabit başlığı (layout.tsx içinde): sekme değişince yeniden çizilmez,
 * yalnızca alttaki içerik yüklenir. Açıklama seçili sekmeye göre değişir.
 */
export function SectionHeader({
  title, tabs, descriptions = {}, description, children,
}: {
  title: string;
  tabs: TabItem[];
  /** sekme adresi → açıklama (en uzun eşleşen adres seçilir) */
  descriptions?: Record<string, string>;
  /** eşleşme yoksa açıklama */
  description?: string;
  /** başlık ile sekmeler arasında (ör. Demo uyarısı) */
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const key = Object.keys(descriptions)
    .filter((k) => pathname === k || pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return (
    <>
      <PageHeader title={title} description={key ? descriptions[key] : description} />
      {children}
      {tabs.length > 1 && <Tabs items={tabs} />}
    </>
  );
}
