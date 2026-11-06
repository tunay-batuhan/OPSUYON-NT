import { Tabs } from "@/components/tabs";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { sectionPages, type Section } from "@/lib/menu";

/**
 * Bölüm alt sayfaları sekme olarak (Personel, Devriye Sistemi, Cari Hesap). Sol menüyle aynı tanımdan
 * gelir; yalnızca açık modüller ve hesabın yetkili olduğu sekmeler görünür. Tek sekme kalırsa çizilmez.
 */
export async function SectionTabs({ section }: { section: Section }) {
  const [user, on] = await Promise.all([getCurrentUser(), getEnabledModules()]);
  if (!user) return null;
  const items = sectionPages(section, user, on);
  return items.length > 1 ? <Tabs items={items} /> : null;
}
