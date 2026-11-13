import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEDGER_BUCKET, ledgerReader } from "@/lib/ledger-access";

/**
 * Cari kaydın dosyasını indirir (fatura PDF'i / görseli, dekont). Kayıt ÇAĞIRANIN oturumuyla okunur:
 * RLS, müşterinin yalnızca kendi firmasının kaydını görmesini sağlar. Ancak o zaman kısa ömürlü imzalı adres verilir.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/ledger/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  if (!(await ledgerReader())) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: e } = await supabase.from("firm_ledger_entries").select("file_path, file_name").eq("id", id).maybeSingle();
  if (!e?.file_path) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(LEDGER_BUCKET).createSignedUrl(e.file_path, 60, { download: e.file_name ?? true });
  if (error || !data) return new NextResponse("Dosya bulunamadı", { status: 404 });

  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
