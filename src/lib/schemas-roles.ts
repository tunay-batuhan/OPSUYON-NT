import { z } from "zod";
import { opt, str } from "@/lib/schemas";

/** Rol oluştur / düzenle: ad, açıklama ve seçilen yetki kodları. */
export const roleSchema = z.object({
  id: z.string(), // boş = yeni rol
  scope: z.enum(["staff", "customer"]),
  name: str("Rol adı", 60).min(3, "Rol adı en az 3 karakter olmalı"),
  description: opt("Açıklama", 200),
  permissions: z.array(z.string().regex(/^[a-z_.]{3,60}$/)).max(200),
});
export type RoleValues = z.infer<typeof roleSchema>;
