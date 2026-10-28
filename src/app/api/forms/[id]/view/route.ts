import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamInline } from "@/lib/inline-file";

/** Form şablonunu indirmeden görüntüleme (sayfa içi). Satır, çağıranın oturumuyla okunur (RLS). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/forms/[id]/view">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: form } = await supabase.from("form_templates").select("storage_bucket, storage_path, file_name, mime_type").eq("id", id).maybeSingle();
  if (!form) return new NextResponse("Not found", { status: 404 });

  return streamInline(form, `/api/forms/${id}`);
}
