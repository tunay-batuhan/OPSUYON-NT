import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamInline } from "@/lib/inline-file";

/**
 * Sayfa içi önizleme (PDF / görsel). Storage'ın kendi adresi iframe'de açılamayan bir
 * güvenlik başlığı gönderdiği için dosya bizim üzerimizden akıtılır. Yetki, çağıranın
 * oturumuyla yapılan RLS okumasıyla belirlenir.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]/view">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_bucket, storage_path, file_name, mime_type")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  return streamInline(doc, `/api/documents/${id}`);
}
