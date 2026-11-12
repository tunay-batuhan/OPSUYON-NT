import { NextResponse } from "next/server";
import { getCurrentUser, homePathFor } from "@/lib/auth";

/**
 * Herkese açık sayfaların üst çubuğundaki "Giriş Yap / Panele git" düğmesi için (components/site/auth-button.tsx).
 * Tanıtım sayfaları statik üretildiği için oturum sunucuda okunmaz; düğme yalnızca tarayıcıda Supabase oturum
 * çerezi varsa burayı sorar. Yalnızca gidilecek adres döner, kişisel bilgi dönmez.
 */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json({ href: user ? homePathFor(user) : null }, { headers: { "Cache-Control": "private, no-store" } });
}
