import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseSecretKey } from "@/lib/supabase/env";

/**
 * İletişim formu güvenliği (üçüncü taraf hizmet yok):
 *  - Form damgası: sayfa üretilirken sunucunun imzaladığı zaman. Form en az MIN_FILL_MS sonra, en geç
 *    MAX_AGE_MS içinde gönderilmeli (botlar formu anında doldurur). İmza sahte zaman yazılmasını engeller.
 *  - IP sınırı: IP adresi SAKLANMAZ; gizli anahtarla alınmış SHA-256 özeti tutulur (30 gün sonra silinir).
 * Gizli anahtar: CONTACT_FORM_SECRET (isteğe bağlı); yoksa Supabase gizli anahtarından türetilir.
 */
export const MIN_FILL_MS = 3_000;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Gönderim sınırları (kayıtlı mesaj sayısına göre). */
export const RATE_LIMITS = {
  perIp10Min: 3,
  perIpDay: 10,
  /** Tüm site için saatlik üst sınır: dağıtık bir saldırıda gelen kutusunu ve veritabanını korur. */
  globalHour: 60,
} as const;

function key(purpose: string): Buffer {
  const base = process.env.CONTACT_FORM_SECRET?.trim() || supabaseSecretKey();
  return createHmac("sha256", base).update(`opsuyon-contact:${purpose}:v1`).digest();
}

const sign = (ts: string) => createHmac("sha256", key("stamp")).update(ts).digest("base64url");

/** Sayfa çizilirken forma konan imzalı zaman damgası. */
export function issueFormStamp(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export type StampCheck = "ok" | "invalid" | "too_fast" | "expired";

export function checkFormStamp(stamp: unknown, now = Date.now()): StampCheck {
  if (typeof stamp !== "string" || stamp.length > 100) return "invalid";
  const [ts, mac] = stamp.split(".");
  if (!ts || !mac || !/^\d{13}$/.test(ts)) return "invalid";
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = now - Number(ts);
  if (age < MIN_FILL_MS) return "too_fast";
  if (age > MAX_AGE_MS) return "expired";
  return "ok";
}

/** IP adresinin gizli anahtarlı özeti (64 hex). Ham IP hiçbir yere yazılmaz. */
export function hashIp(ip: string): string {
  return createHmac("sha256", key("ip")).update(ip.trim().toLowerCase()).digest("hex");
}

/**
 * İsteğin IP adresi. Vercel `x-forwarded-for` başlığını kendisi yazar (ilk değer istemcidir); yerelde başlık
 * yoksa "unknown" (hepsi aynı kovaya düşer).
 */
export function clientIp(h: Headers): string {
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip")?.trim() || "unknown";
}
