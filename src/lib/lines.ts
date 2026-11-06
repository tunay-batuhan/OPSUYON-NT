import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ServiceLine } from "@/lib/types";

/** Used only if the database is unreachable, so the landing page still renders. */
const FALLBACK: ServiceLine[] = [
  { code: "guvenlik", name: "Güvenlik", description: "Özel güvenlik personeli ve operasyon yönetimi", icon: "shield-check", sort_order: 10, is_active: true },
  { code: "temizlik", name: "Temizlik", description: "Temizlik personeli ve operasyon yönetimi", icon: "sparkles", sort_order: 20, is_active: true },
  { code: "danisma_tesis", name: "Danışma", description: "Danışma ve resepsiyon personeli yönetimi", icon: "concierge-bell", sort_order: 40, is_active: true },
  { code: "tesis_yonetimi", name: "Tesis Yönetimi", description: "Tesis ve bina yönetimi hizmetleri", icon: "building-2", sort_order: 45, is_active: true },
  { code: "teknik_personel", name: "Teknik Personel", description: "Teknik personel hizmetleri", icon: "wrench", sort_order: 50, is_active: true },
];

async function loadLines(activeOnly: boolean): Promise<ServiceLine[]> {
  try {
    const supabase = await createClient();
    let q = supabase.from("service_lines").select("*");
    if (activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q.order("sort_order");
    if (error || !data?.length) return FALLBACK;
    return data as ServiceLine[];
  } catch {
    return FALLBACK;
  }
}

/** Aktif hizmet alanları: kartlar, yeni proje formu, filtreler. */
export async function getServiceLines(): Promise<ServiceLine[]> {
  return loadLines(true);
}

/** Pasifler dahil (ör. Kurumsal Tedarik): eski projelerin hat adını göstermek için. */
export async function getAllServiceLines(): Promise<ServiceLine[]> {
  return loadLines(false);
}

/** Kart başlığı: "Güvenlik Yönetimi"; ad zaten "Yönetimi" ile bitiyorsa tekrar eklenmez ("Tesis Yönetimi"). */
export function lineTitle(name: string): string {
  const n = name.trim();
  return n.toLocaleLowerCase("tr").endsWith("yönetimi") ? n : `${n} Yönetimi`;
}

/** { guvenlik: "Güvenlik", … } */
export async function getLineNames(): Promise<Record<string, string>> {
  return Object.fromEntries((await getServiceLines()).map((l) => [l.code, l.name]));
}
