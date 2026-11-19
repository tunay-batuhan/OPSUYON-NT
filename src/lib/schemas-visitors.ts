// Ziyaretçi Takip: tarayıcıda ve sunucuda AYNI şemalar.
import { z } from "zod";
import { opt, phone, str, uuid } from "@/lib/schemas";

export const visitorSchema = z.object({
  project_id: uuid("Proje"),
  full_name: str("Ad soyad", 120).refine((v) => v.length >= 2, "Ad soyad en az 2 harf olmalı"),
  phone,
  plate: opt("Plaka", 20),
  destination: str("Nereye (daire / firma)", 120),
  approval: z.enum(["onaylandi", "reddedildi", "bekliyor"], { message: "Sakinin onayını seçin" }),
  note: opt("Not", 500),
});
export type VisitorValues = z.infer<typeof visitorSchema>;

export const cargoSchema = z.object({
  project_id: uuid("Proje"),
  courier: str("Kargo firması", 60),
  destination: str("Kime (daire / firma)", 120),
  package_count: z.number().int("Paket sayısı tam sayı olmalı").min(1, "En az 1 paket").max(99, "En fazla 99 paket"),
  full_name: opt("Kurye adı", 120),
  note: opt("Not", 500),
  /** kurye doğrudan sahibine verdiyse kulübede bekletilmez */
  delivered_now: z.boolean(),
  delivered_to: opt("Teslim alan", 120),
});
export type CargoValues = z.infer<typeof cargoSchema>;

/** İlk hatalı alanın mesajı ve alan hataları (form üstünde gösterim için). */
export function firstErrors(err: z.ZodError): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "");
    if (k && !fields[k]) fields[k] = i.message;
  }
  return { message: err.issues[0]?.message ?? "Bilgileri kontrol edin", fields };
}
