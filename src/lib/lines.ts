import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ServiceLine } from "@/lib/types";

/** Used only if the database is unreachable, so the landing page still renders. */
const FALLBACK: ServiceLine[] = [
  { code: "guvenlik", name: "Güvenlik", description: "Özel güvenlik personeli ve operasyon yönetimi", icon: "shield-check", sort_order: 10, is_active: true },
  { code: "temizlik", name: "Temizlik", description: "Temizlik personeli ve operasyon yönetimi", icon: "sparkles", sort_order: 20, is_active: true },
  { code: "kurumsal_tedarik", name: "Kurumsal Tedarik", description: "Kurumsal personel tedariği ve süreç takibi", icon: "briefcase", sort_order: 30, is_active: true },
];

export async function getServiceLines(): Promise<ServiceLine[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_lines")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data?.length) return FALLBACK;
    return data as ServiceLine[];
  } catch {
    return FALLBACK;
  }
}
