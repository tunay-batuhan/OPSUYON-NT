import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadOrgLogo } from "@/lib/org-logo";

/**
 * Firma logosu (görsel). Firmaları görebilen merkez kullanıcısı ya da o firmanın müşteri hesabı açabilir.
 * Firma formundaki önizleme ve müşteri panelinin sol üstü buradan okur.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/firma-logo/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const allowed = (user.kind === "staff" && hasPermission(user, "organizations.read")) || (user.kind === "customer" && user.organization_id === id);
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const { data } = await createAdminClient().from("organizations").select("logo_path").eq("id", id).maybeSingle();
  const logo = await downloadOrgLogo((data as { logo_path?: string | null } | null)?.logo_path);
  if (!logo) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(logo.bytes), {
    headers: { "Content-Type": logo.mime, "Cache-Control": "private, max-age=300", "Content-Security-Policy": "default-src 'none'" },
  });
}
