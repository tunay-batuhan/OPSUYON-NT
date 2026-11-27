import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/format";
import { isImageFile, loadTaskDetail } from "@/lib/task-detail";
import { buildTaskPdf } from "@/lib/pdf/tasks-pdf";
import { withAssigneeNames } from "@/lib/task-data";

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Tek görevin PDF'i (görev formu + fotoğraflar). Görev kullanıcının oturumuyla okunur (RLS): müdür projede tasks.read,
 * personel yalnızca kendi görevi; merkez görevini merkezde tasks.read yetkisi olan ya da görevin atandığı kullanıcı. Fotoğraflar (JPG/PNG, en fazla 6) PDF'e gömülür; diğer dosyalar adıyla listelenir.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/is-planlama/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const loaded = await loadTaskDetail(await createClient(), id);
  if (!loaded) return new NextResponse("Not found", { status: 404 });
  // merkez görevinde atanan kullanıcının adı (satırı RLS yalnızca merkez kullanıcısına verir)
  const detail = { ...loaded, task: (await withAssigneeNames([loaded.task]))[0] };

  const admin = createAdminClient();
  const candidates = detail.files.filter((f) => isImageFile(f) && /\.(jpe?g|png)$|image\/(jpeg|png)/i.test(`${f.file_name} ${f.mime_type ?? ""}`)).slice(0, MAX_IMAGES);
  const { data: paths } = candidates.length
    ? await admin.from("work_task_files").select("id, storage_path").in("id", candidates.map((f) => f.id))
    : { data: [] };
  const pathOf = new Map(((paths ?? []) as { id: string; storage_path: string }[]).map((p) => [p.id, p.storage_path]));
  const images = (
    await Promise.all(
      candidates.map(async (f) => {
        const path = pathOf.get(f.id);
        if (!path || (f.size_bytes ?? 0) > MAX_IMAGE_BYTES) return null;
        const { data } = await admin.storage.from("documents").download(path);
        if (!data) return null;
        const bytes: Uint8Array = new Uint8Array(await data.arrayBuffer());
        const png = bytes[0] === 0x89 && bytes[1] === 0x50;
        const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
        return png || jpg ? { bytes, png, caption: f.file_name } : null;
      }),
    )
  ).filter((x) => x !== null);

  const pdf = await buildTaskPdf({ ...detail, images });
  const name = `gorev-${slugify(detail.task.title).slice(0, 40) || "form"}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
