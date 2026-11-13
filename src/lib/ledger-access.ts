import "server-only";
import { canAnywhere, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";

/** Cari dosyaları Storage'da bu kovada durur (özel kova; yalnızca imzalı adresle). */
export const LEDGER_BUCKET = "documents";

/**
 * Cari Hesap API'leri (dosya indirme / görüntüleme, ekstre PDF) için ekranla aynı kapı:
 * merkezde ledger.read; müşteride Cari Hesap modülü açık, hesap bir firmaya bağlı ve en az bir projede ledger.read.
 * Hangi satırları görebileceğine ayrıca veritabanı (RLS) karar verir: müşteri yalnızca kendi firmasını görür.
 */
export async function ledgerReader(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canAnywhere(user, "ledger.read")) return null;
  if (user.kind === "customer") {
    if (!user.organization_id) return null;
    if (!(await getEnabledModules()).has("cari_hesap")) return null;
  }
  return user;
}
