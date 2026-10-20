import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Form şablonu indirme: satır çağıranın oturumuyla okunur (RLS), sonra kısa ömürlü imzalı adres verilir. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/forms/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: form } = await supabase.from("form_templates").select("storage_bucket, storage_path, file_name").eq("id", id).maybeSingle();
  if (!form) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(form.storage_bucket).createSignedUrl(form.storage_path, 60, { download: form.file_name });
  if (error || !data) return new NextResponse("Dosya bulunamadı", { status: 404 });

  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
