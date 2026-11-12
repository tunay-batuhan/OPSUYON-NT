"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RATE_LIMITS, checkFormStamp, clientIp, hashIp } from "@/lib/contact";
import {
  contactFieldErrors, contactSchema, contactValuesFrom, isContactStatus, type ContactState,
} from "@/lib/schemas-contact";
import { nul } from "@/lib/form";

const INBOX = "/merkez/iletisim-talepleri";
const TRY_LATER = "Şu anda mesajınızı alamadık. Lütfen biraz sonra tekrar deneyin ya da bize e-posta veya telefonla ulaşın.";

/**
 * Herkese açık iletişim formu (useActionState; JavaScript olmadan da çalışır).
 * Sıra: gizli alan (honeypot) → imzalı form damgası (en az 3 sn) → şema → IP özeti ile gönderim sınırı → kayıt.
 * Kayıt servis anahtarıyla yapılır (tabloya anonim erişim yok). Mesaj içeriği loglanmaz.
 */
export async function submitContactMessage(_prev: ContactState, fd: FormData): Promise<ContactState> {
  const values = contactValuesFrom(fd);

  // 1) Gizli alan: insanlar görmez; doluysa bot. Bota başarılı gibi görünür, hiçbir şey kaydedilmez.
  const trap = fd.get("website");
  if (typeof trap === "string" && trap.trim() !== "") return { ok: true };

  // 2) Form damgası
  const rawStamp = fd.get("stamp");
  const stamp = checkFormStamp(rawStamp);
  // Geçerli damga hata yanıtıyla geri döner: sayfa yeniden çizilse de (JS'siz) form ilk açılış zamanını korur,
  // düzeltip hemen yeniden gönderen kişi "çok hızlı" hatası almaz.
  const keep = { values, stamp: (stamp === "ok" || stamp === "too_fast") && typeof rawStamp === "string" ? rawStamp : undefined };
  if (stamp === "too_fast") return { error: "Form çok hızlı gönderildi. Lütfen birkaç saniye bekleyip tekrar gönderin.", ...keep };
  if (stamp === "expired" || stamp === "invalid") {
    return { error: "Formun süresi doldu. Sayfayı yenileyip tekrar gönderin (yazdıklarınız aşağıda duruyor).", values };
  }

  // 3) Doğrulama (tarayıcıdaki ile aynı şema)
  const fieldErrors = contactFieldErrors(values);
  if (fieldErrors) return { error: "Lütfen işaretli alanları düzeltin.", fieldErrors, ...keep };
  const data = contactSchema.parse(values);

  try {
    const admin = createAdminClient();
    const ipHash = hashIp(clientIp(await headers()));
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

    // 4) Gönderim sınırı
    const [ip10, ipDay, all] = await Promise.all([
      admin.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", ago(10 * 60_000)),
      admin.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", ago(24 * 3_600_000)),
      admin.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", ago(3_600_000)),
    ]);
    if (ip10.error || ipDay.error || all.error) return { error: TRY_LATER, ...keep };
    if ((ip10.count ?? 0) >= RATE_LIMITS.perIp10Min || (ipDay.count ?? 0) >= RATE_LIMITS.perIpDay) {
      return { error: "Kısa sürede çok sayıda mesaj gönderildi. Lütfen daha sonra tekrar deneyin ya da bize e-posta ile yazın.", ...keep };
    }
    if ((all.count ?? 0) >= RATE_LIMITS.globalHour) return { error: TRY_LATER, ...keep };

    // 5) Kayıt
    const { error } = await admin.from("contact_messages").insert({
      full_name: data.full_name,
      company: nul(data.company),
      email: data.email.toLowerCase(),
      phone: nul(data.phone),
      topic: data.topic,
      message: data.message,
      ip_hash: ipHash,
    });
    if (error) return { error: TRY_LATER, ...keep };
  } catch {
    return { error: TRY_LATER, ...keep };
  }

  revalidatePath(INBOX);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Gelen kutusu (yalnızca Süper Yönetici)                               */
/* ------------------------------------------------------------------ */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setContactMessageStatus(fd: FormData): Promise<void> {
  const user = await assertSuperAdmin();
  const id = fd.get("id");
  const status = fd.get("status");
  if (typeof id !== "string" || !UUID_RE.test(id) || !isContactStatus(status)) return;
  await createAdminClient()
    .from("contact_messages")
    .update({ status, handled_by: status === "yeni" ? null : user.id, handled_at: status === "yeni" ? null : new Date().toISOString() })
    .eq("id", id);
  revalidatePath(INBOX, "layout");
}

export async function deleteContactMessage(fd: FormData): Promise<void> {
  await assertSuperAdmin();
  const id = fd.get("id");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;
  await createAdminClient().from("contact_messages").delete().eq("id", id);
  revalidatePath(INBOX, "layout");
  // ayrıntı sayfasından silinince listeye dönülür
  if (fd.get("from") === "detail") redirect(INBOX);
}
