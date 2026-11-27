import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type CurrentUser } from "@/lib/auth";
import type { ExpiryKind } from "@/lib/pdf/personnel-forms";

/** Sağlık raporu / güvenlik kimlik kartı bitişine 6 ay kala merkez kullanıcılarına her gün uyarı. */
export const EXPIRY_WARN_MONTHS = 6;

export type ExpiryAlert = {
  personnel_id: string;
  full_name: string;
  title: string | null;
  kind: ExpiryKind;
  until: string;
  /** bugünden bitişe kalan gün (geçmişse eksi) */
  days_left: number;
};

const istanbulToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Uyarıları yalnızca personel kartını görebilen merkez kullanıcıları görür. */
type AlertUser = Pick<CurrentUser, "kind" | "roleCode" | "permissions"> | null | undefined;
export const seesExpiryAlerts = (user: AlertUser): boolean => Boolean(user) && hasPermission(user!, "personnel.read");

/**
 * Bitişi 6 ay içinde olan (ya da geçmiş) belgeler; ayrılan personel hariç. Kullanıcının bugün kapattıkları gösterilmez,
 * ertesi gün yeniden çıkar. Sütunlar henüz yoksa (migration uygulanmadıysa) boş liste döner.
 */
export async function loadExpiryAlerts(user: AlertUser): Promise<ExpiryAlert[]> {
  if (!seesExpiryAlerts(user)) return [];
  const supabase = await createClient();
  const today = istanbulToday();
  const limit = addMonths(today, EXPIRY_WARN_MONTHS);
  const [{ data, error }, { data: dismissed }] = await Promise.all([
    supabase
      .from("personnel")
      .select("id, full_name, title, health_report_until, security_card_until")
      .neq("status", "terminated")
      .or(`health_report_until.lte.${limit},security_card_until.lte.${limit}`)
      .limit(500),
    supabase.from("expiry_alert_dismissals").select("personnel_id, kind").eq("dismissed_on", today),
  ]);
  if (error || !data) return [];
  const hidden = new Set((dismissed ?? []).map((d) => `${d.personnel_id}:${d.kind}`));
  const out: ExpiryAlert[] = [];
  for (const p of data as { id: string; full_name: string; title: string | null; health_report_until: string | null; security_card_until: string | null }[]) {
    for (const [kind, until] of [["health_report", p.health_report_until], ["security_card", p.security_card_until]] as const) {
      if (!until || until > limit || hidden.has(`${p.id}:${kind}`)) continue;
      out.push({ personnel_id: p.id, full_name: p.full_name, title: p.title, kind, until, days_left: dayDiff(today, until) });
    }
  }
  return out.sort((a, b) => a.until.localeCompare(b.until));
}
