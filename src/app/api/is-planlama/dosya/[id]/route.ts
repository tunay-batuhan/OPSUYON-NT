import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamInline } from "@/lib/inline-file";

/**
 * Görev dosyası (fotoğraf / PDF). Satır kullanıcının oturumuyla okunur: RLS izin veriyorsa (projede tasks.read ya da
 * görev personelin kendisine aitse) kısa ömürlü imzalı adres üretilir.
 *   ?goster=1 → tarayıcıda aç (görsel önce sığdırılmış sayfada; ?ham=1 görselin kendisi)
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/is-planlama/dosya/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: f } = await supabase.from("work_task_files").select("storage_path, file_name, mime_type").eq("id", id).maybeSingle();
  if (!f) return new NextResponse("Not found", { status: 404 });

  const q = req.nextUrl.searchParams;
  const download = `/api/is-planlama/dosya/${id}`;
  if (q.get("goster")) {
    return streamInline({ storage_bucket: "documents", storage_path: f.storage_path, file_name: f.file_name, mime_type: f.mime_type }, download, q.get("ham") === "1");
  }
  const { data, error } = await createAdminClient().storage.from("documents").createSignedUrl(f.storage_path, 60, { download: f.file_name });
  if (error || !data) return new NextResponse("Dosya bulunamadı", { status: 404 });
  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
