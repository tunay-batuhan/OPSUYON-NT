import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadOrgBranding } from "@/lib/org-logo";
import { slugify } from "@/lib/format";
import { buildExpiryNoticePdf, buildMealCardFormPdf, type ExpiryKind } from "@/lib/pdf/personnel-forms";

const KINDS: Record<string, ExpiryKind> = { "saglik-raporu": "health_report", "guvenlik-kimlik": "security_card" };

/**
 * Personele basılan formlar (PDF, yeni sekmede açılır). Yalnızca merkez kullanıcıları (personel kartını görebilen).
 *   yemek-karti      Yemek kartı teslim formu; ?no= verilirse formdaki (kaydedilmemiş) numara, yoksa karttaki
 *   saglik-raporu    Sağlık raporu geçerlilik süresi bildirimi
 *   guvenlik-kimlik  Güvenlik kimlik kartı geçerlilik süresi bildirimi
 * Başlıkta personelin kadrosundaki firmanın (personnel.organization_id) logosu ve bilgileri yer alır.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/personel/[id]/form/[tur]">) {
  const { id, tur } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(tur === "yemek-karti" || tur in KINDS)) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.kind !== "staff" || !hasPermission(user, "personnel.read")) return new NextResponse("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data: person } = await supabase.from("personnel").select("id, full_name, title, organization_id").eq("id", id).maybeSingle();
  if (!person) return new NextResponse("Not found", { status: 404 });
  const { data: cards } = await supabase.from("personnel").select("meal_card_no, health_report_until, security_card_until").eq("id", id).maybeSingle();
  const c = (cards ?? {}) as { meal_card_no?: string | null; health_report_until?: string | null; security_card_until?: string | null };
  const org = await loadOrgBranding(person.organization_id as string | null);
  const p = { full_name: person.full_name as string, title: (person.title as string | null) ?? null };

  let pdf: Uint8Array;
  let name: string;
  if (tur === "yemek-karti") {
    const no = (req.nextUrl.searchParams.get("no") ?? c.meal_card_no ?? "").trim().slice(0, 40);
    if (!no) return new NextResponse("Yemek kartı numarası girilmemiş.", { status: 400 });
    pdf = await buildMealCardFormPdf({ org, person: p, cardNo: no, receiver: user.full_name });
    name = `yemek-karti-teslim-${slugify(p.full_name)}.pdf`;
  } else {
    const kind = KINDS[tur];
    const until = kind === "health_report" ? c.health_report_until : c.security_card_until;
    if (!until) return new NextResponse("Geçerlilik bitiş tarihi girilmemiş.", { status: 400 });
    pdf = await buildExpiryNoticePdf({ org, person: p, kind, until, issuer: user.full_name });
    name = `${tur}-bildirimi-${slugify(p.full_name)}.pdf`;
  }
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
