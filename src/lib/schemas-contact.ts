// İletişim formu (herkese açık /iletisim). Tarayıcıda (gönderimden önce) ve sunucuda (action içinde) AYNI şema çalışır.
import { z } from "zod";
import { email, opt, phone, str } from "@/lib/schemas";

export const CONTACT_TOPICS = {
  teklif: "Teklif",
  demo: "Demo talebi",
  destek: "Destek",
  diger: "Diğer",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;
export const isContactTopic = (v: unknown): v is ContactTopic => typeof v === "string" && Object.hasOwn(CONTACT_TOPICS, v);

export const CONTACT_STATUS = { yeni: "Yeni", okundu: "Okundu", yanitlandi: "Yanıtlandı" } as const;
export type ContactStatus = keyof typeof CONTACT_STATUS;
export const isContactStatus = (v: unknown): v is ContactStatus => typeof v === "string" && Object.hasOwn(CONTACT_STATUS, v);

export const CONTACT_LIMITS = { name: 100, company: 120, email: 120, phone: 20, messageMin: 10, message: 3000 } as const;

export const contactSchema = z.object({
  full_name: str("Ad soyad", CONTACT_LIMITS.name).min(2, "Adınızı ve soyadınızı yazın"),
  company: opt("Firma", CONTACT_LIMITS.company),
  email: email.refine((v) => v !== "", "E-posta adresinizi yazın"),
  phone: phone.refine((v) => v.length <= CONTACT_LIMITS.phone, "Telefon numarası çok uzun"),
  topic: z.string().refine(isContactTopic, "Bir konu seçin"),
  message: str("Mesaj", CONTACT_LIMITS.message).min(CONTACT_LIMITS.messageMin, `Mesajınız en az ${CONTACT_LIMITS.messageMin} karakter olmalı`),
  kvkk: z.literal(true, { error: "Devam etmek için aydınlatma metnini okuduğunuzu onaylayın" }),
});
export type ContactValues = z.infer<typeof contactSchema>;

/** Form alanlarını (FormData) şemanın beklediği nesneye çevirir; tarayıcıda ve sunucuda aynı. */
export function contactValuesFrom(fd: FormData) {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    full_name: s("full_name"),
    company: s("company"),
    email: s("email"),
    phone: s("phone"),
    topic: s("topic"),
    message: s("message"),
    kvkk: fd.get("kvkk") === "on",
  };
}

/** Gönderim sonucu (useActionState). Hata durumunda girilen değerler geri döner ki JavaScript'siz de kaybolmasın. */
export type ContactState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ContactValues, string>>;
  values?: Omit<ReturnType<typeof contactValuesFrom>, "kvkk"> & { kvkk: boolean };
  /** Hata yanıtında geri dönen (geçerli) form damgası. */
  stamp?: string;
} | null;

/** Zod hatalarını alan → ilk mesaj sözlüğüne çevirir. */
export function contactFieldErrors(values: unknown): Partial<Record<keyof ContactValues, string>> | null {
  const parsed = contactSchema.safeParse(values);
  if (parsed.success) return null;
  const out: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
