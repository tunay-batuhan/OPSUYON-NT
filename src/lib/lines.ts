import "server-only";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";
import type { ServiceLine } from "@/lib/types";

/** Used only if the database is unreachable, so the landing page still renders. */
export const FALLBACK_SERVICE_LINES: ServiceLine[] = [
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
    if (error || !data?.length) return FALLBACK_SERVICE_LINES;
    return data as ServiceLine[];
  } catch {
    return FALLBACK_SERVICE_LINES;
  }
}

/** Aktif hizmet alanları: kartlar, yeni proje formu, filtreler. */
export async function getServiceLines(): Promise<ServiceLine[]> {
  return loadLines(true);
}

/**
 * Herkese açık tanıtım sayfası için: oturum çerezine BAKMADAN (anonim anahtarla) aktif hizmet alanları.
 * Çerez okunmadığı için sayfa statik üretilebilir (ISR); anonim okuma izni migration 07'de (yalnızca aktifler).
 */
export async function getPublicServiceLines(): Promise<ServiceLine[]> {
  try {
    const supabase = createAnonClient(supabaseUrl(), supabasePublicKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.from("service_lines").select("*").eq("is_active", true).order("sort_order");
    if (error || !data?.length) return FALLBACK_SERVICE_LINES;
    return data as ServiceLine[];
  } catch {
    return FALLBACK_SERVICE_LINES;
  }
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
