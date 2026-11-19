// Ziyaretçi Takip: istemci ve sunucunun ortak tipleri ve küçük yardımcıları.

export type VisitorKind = "ziyaretci" | "kargo";
export type Approval = "onaylandi" | "reddedildi" | "bekliyor";

export type VisitorLog = {
  id: string;
  project_id: string;
  kind: VisitorKind;
  full_name: string | null;
  phone: string | null;
  plate: string | null;
  destination: string;
  approval: Approval | null;
  courier: string | null;
  package_count: number;
  note: string | null;
  entered_at: string;
  exited_at: string | null;
  delivered_at: string | null;
  delivered_to: string | null;
  recorder: string | null;
  /** kaydı giren güvenlik personeli (panelden girildiyse null) */
  by_personnel: string | null;
};

export const LOG_COLUMNS =
  "id, project_id, kind, full_name, phone, plate, destination, approval, courier, package_count, note, entered_at, exited_at, delivered_at, delivered_to, personnel_id, created_by";

export const APPROVAL: Record<Approval, { label: string; tone: "success" | "danger" | "warning" }> = {
  onaylandi: { label: "Onaylandı", tone: "success" },
  reddedildi: { label: "Reddedildi", tone: "danger" },
  bekliyor: { label: "Onay bekliyor", tone: "warning" },
};

/** Kulübede en sık gelen kargo / teslimat firmaları (tek dokunuşla seçilir; "Diğer" ile yazılır). */
export const COURIERS = ["Yurtiçi", "Aras", "MNG", "PTT", "Sürat", "Trendyol Express", "Hepsijet", "Amazon", "Kolay Gelsin", "Yemek / market"];

/** Plaka: büyük harf, boşluksuz (34 abc 123 → 34ABC123). */
export const normalizePlate = (s: string) => s.toLocaleUpperCase("tr-TR").replace(/[^0-9A-ZÇĞİÖŞÜ]/g, "").slice(0, 15);

/** Güvenlik personeli kendi kaydını bu kadar süre içinde silebilir (sunucu da denetler). */
export const OWN_DELETE_MINUTES = 30;
/** Silinebilirlik sınırı (ISO): bu andan sonra girilen kendi kayıtları silinebilir. Sunucu sayfasında hesaplanır. */
export const ownDeleteSince = () => new Date(Date.now() - OWN_DELETE_MINUTES * 60 * 1000).toISOString();

/** Saat (Türkiye): 14:05 */
export const hhmm = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

/** Gün + saat (Türkiye): 19.11.2026 14:05 */
export const dayTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : "";

/** Bir kaydın durumu (liste ve rapor için). */
export function logStatus(l: Pick<VisitorLog, "kind" | "approval" | "exited_at" | "delivered_at">): { label: string; tone: "success" | "danger" | "warning" | "brand" | "neutral" } {
  if (l.kind === "kargo") return l.delivered_at ? { label: "Teslim edildi", tone: "success" } : { label: "Kulübede bekliyor", tone: "warning" };
  if (l.approval === "reddedildi") return { label: "Reddedildi", tone: "danger" };
  if (l.approval === "bekliyor") return { label: "Onay bekliyor", tone: "warning" };
  return l.exited_at ? { label: "Çıkış yaptı", tone: "neutral" } : { label: "İçeride", tone: "brand" };
}
