import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionState } from "@/lib/action-types";

/** Trimmed string field, or null when empty. */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type PgError = { code?: string; message?: string } | null | undefined;

export function pgMessage(error: PgError): string {
  if (!error) return "Beklenmeyen bir hata oluştu.";
  switch (error.code) {
    case "23505": return "Bu kayıt zaten mevcut.";
    case "23503": return "İlişkili kayıt bulunamadı ya da kayıt başka verilerle ilişkili.";
    case "23514": return "Girilen değerler geçerli değil.";
    case "42501": return "Bu işlem için yetkiniz yok.";
    default: return error.message ?? "Beklenmeyen bir hata oluştu.";
  }
}

/** Runs a server action body; turns thrown errors into { error } but lets Next redirects through. */
export async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu." };
  }
}

/** Server-side re-validation with the SAME schema the browser used. */
export function validate<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { ok: true; data: z.output<S> } | { ok: false; state: NonNullable<ActionState> } {
  const parsed = schema.safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, state: { error: "Lütfen işaretli alanları düzeltin.", fieldErrors } };
}

/** "" → null, otherwise trimmed string. */
export const nul = (v: string | undefined | null): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
