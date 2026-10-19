import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const type = doc.mime_type ?? "";
  const previewable = type === "application/pdf" || type.startsWith("image/") || /\.(pdf|png|jpe?g)$/i.test(doc.file_name);
  if (!previewable) return NextResponse.redirect(new URL(`/api/documents/${id}`, _req.url));

  const { data: signed, error } = await createAdminClient().storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 60);
  if (error || !signed) return new NextResponse("Dosya bulunamadı", { status: 404 });

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok || !upstream.body) return new NextResponse("Dosya okunamadı", { status: 502 });

  const contentType = /\.pdf$/i.test(doc.file_name) ? "application/pdf" : (upstream.headers.get("content-type") ?? type) || "application/octet-stream";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
