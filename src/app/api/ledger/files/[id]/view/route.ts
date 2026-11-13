import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamInline } from "@/lib/inline-file";
import { LEDGER_BUCKET, ledgerReader } from "@/lib/ledger-access";

/** Cari kaydın dosyasını sayfa içinde gösterir (PDF / görsel). Yetki: çağıranın oturumuyla RLS okuması. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/ledger/files/[id]/view">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  if (!(await ledgerReader())) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: e } = await supabase.from("firm_ledger_entries").select("file_path, file_name, file_mime").eq("id", id).maybeSingle();
  if (!e?.file_path || !e.file_name) return new NextResponse("Not found", { status: 404 });

  return streamInline(
    { storage_bucket: LEDGER_BUCKET, storage_path: e.file_path, file_name: e.file_name, mime_type: e.file_mime },
    `/api/ledger/files/${id}`,
    req.nextUrl.searchParams.has("ham"),
  );
}
