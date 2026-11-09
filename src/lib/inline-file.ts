import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type FileRef = { storage_bucket: string; storage_path: string; file_name: string; mime_type: string | null };

export const isPreviewable = (f: Pick<FileRef, "file_name" | "mime_type">) => {
  const type = f.mime_type ?? "";
  return type === "application/pdf" || type.startsWith("image/") || /\.(pdf|png|jpe?g)$/i.test(f.file_name);
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sayfa içi görüntüleyicide önizlenemeyen dosyalar (Excel, Word…) için küçük bir bilgi sayfası. */
export function notPreviewablePage(fileName: string, downloadHref: string) {
  const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#334155;background:#f8fafc">
<div style="text-align:center;padding:24px;max-width:420px">
<p style="font-size:15px;margin:0 0 6px"><strong>${esc(fileName)}</strong></p>
<p style="font-size:14px;margin:0 0 18px;color:#64748b">Bu dosya türü sayfada görüntülenemez. İndirerek açabilirsiniz.</p>
<a href="${esc(downloadHref)}" target="_top" style="display:inline-block;background:#1f6fe5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600">İndir</a>
</div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}

const isImage = (f: Pick<FileRef, "file_name" | "mime_type">) =>
  !/\.pdf$/i.test(f.file_name) && ((f.mime_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(f.file_name));

/**
 * Görsel (ör. telefonla çekilmiş rapor fotoğrafı) gerçek boyutunda açılınca görüntüleyiciye sığmıyordu:
 * görsel önce bütünüyle görünecek şekilde sığdırılır; tıklayınca genişliğe büyür (okumak için), tekrar tıklayınca küçülür.
 */
function imagePage(fileName: string) {
  const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fileName)}</title>
<style>html,body{margin:0;background:#f1f5f9}img{display:block;max-width:100%;max-height:100vh;width:auto;height:auto;margin:0 auto;cursor:zoom-in;background:#fff}img.big{max-height:none;cursor:zoom-out}</style>
<body><img src="?ham=1" alt="${esc(fileName)}" onclick="this.classList.toggle('big')"></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}

/**
 * Yetkisi çağıran tarafından doğrulanmış dosyayı, indirmeden (inline) tarayıcıya akıtır.
 * Görseller önce sığdırılmış bir sayfa olarak döner; o sayfa görselin kendisini `?ham=1` ile ister.
 */
export async function streamInline(f: FileRef, downloadHref: string, raw = false) {
  if (!isPreviewable(f)) return notPreviewablePage(f.file_name, downloadHref);
  if (!raw && isImage(f)) return imagePage(f.file_name);

  const { data: signed, error } = await createAdminClient().storage.from(f.storage_bucket).createSignedUrl(f.storage_path, 60);
  if (error || !signed) return new NextResponse("Dosya bulunamadı", { status: 404 });

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok || !upstream.body) return new NextResponse("Dosya okunamadı", { status: 502 });

  const type = f.mime_type ?? "";
  const contentType = /\.pdf$/i.test(f.file_name) ? "application/pdf" : (upstream.headers.get("content-type") ?? type) || "application/octet-stream";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
