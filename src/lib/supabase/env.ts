// Shared by server code and proxy.ts (no `server-only` import so the proxy can use it).
export function supabaseUrl(): string {
  const v = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("SUPABASE_URL tanımlı değil (.env)");
  return v;
}

export function supabasePublicKey(): string {
  const v = process.env.SUPABASE_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new Error("SUPABASE_PUBLIC_KEY tanımlı değil (.env)");
  return v;
}

export function supabaseSecretKey(): string {
  const v = process.env.SUPABASE_SECRET_KEY;
  if (!v) throw new Error("SUPABASE_SECRET_KEY tanımlı değil (.env)");
  return v;
}

/** Login is username-based; Supabase Auth needs an e-mail, so we derive a private one. */
export const AUTH_EMAIL_DOMAIN = "portal.opsuyon.com";
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
