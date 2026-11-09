import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Service-level client. BYPASSES RLS — use only inside server actions / route
 * handlers AFTER the caller's permission has been verified.
 *
 * `actorId`: işlemi başlatan kullanıcı. Yazma işlemlerinde verilirse veritabanının işlem geçmişi (app.audit_row)
 * kaydı "Sistem" yerine bu kullanıcı adına yazar (x-actor-id başlığı; yalnızca service_role isteklerinde dikkate alınır).
 */
export function createAdminClient(actorId?: string) {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(actorId ? { global: { headers: { "x-actor-id": actorId } } } : {}),
  });
}
