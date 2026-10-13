import { NextResponse } from "next/server";
import { envStatus } from "@/lib/supabase/env";

// Deployment self-check: reports which settings exist (names only, never values)
// and whether Supabase answers. Safe to expose; remove once the site is final if you prefer.
export const dynamic = "force-dynamic";

export async function GET() {
  const env = envStatus();
  let supabase: "ok" | "unreachable" | "not-configured" = "not-configured";
  if (env.SUPABASE_URL && env.SUPABASE_PUBLIC_KEY) {
    try {
      const key = process.env.SUPABASE_PUBLIC_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
      const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store" });
      supabase = res.ok ? "ok" : "unreachable";
    } catch {
      supabase = "unreachable";
    }
  }
  const ready = env.SUPABASE_URL && env.SUPABASE_PUBLIC_KEY && env.SUPABASE_SECRET_KEY && supabase === "ok";
  return NextResponse.json({ ready, env, supabase }, { status: ready ? 200 : 503 });
}
