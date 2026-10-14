import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runImport } from "@/lib/import/engine";
import { IMPORT_DEFS, type ImportType } from "@/lib/import/defs";
import { slugify } from "@/lib/format";
import { toNumber } from "@/lib/parse";

export const maxDuration = 60;
const MAX_BYTES = 10 * 1024 * 1024;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.kind !== "staff" || !hasPermission(user, "imports.manage")) return fail("Bu işlem için yetkiniz yok.", 403);

  const fd = await req.formData();
  const file = fd.get("file");
  const projectId = String(fd.get("project_id") ?? "");
  const type = String(fd.get("type") ?? "") as ImportType;
  const mode = fd.get("mode") === "commit" ? "commit" : "preview";

  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return fail("Geçersiz proje.");
  const def = IMPORT_DEFS[type];
  if (!def) return fail("İçe aktarma türünü seçin.");
  if (!hasPermission(user, def.permission)) return fail(`${def.title} içe aktarmak için yetkiniz yok.`, 403);
  if (!(file instanceof File) || file.size === 0) return fail("Bir Excel dosyası seçin.");
  if (file.size > MAX_BYTES) return fail("Dosya 10 MB'tan büyük olamaz.");
  if (!/\.xlsx$/i.test(file.name)) {
    return fail("Yalnızca .xlsx dosyaları desteklenir. Eski .xls veya .csv dosyasını Excel'de 'Farklı kaydet → Excel Çalışma Kitabı (.xlsx)' ile dönüştürün.");
  }

  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) return fail("Proje bulunamadı.", 404);

  const year = toNumber(String(fd.get("year") ?? ""));
  const month = toNumber(String(fd.get("month") ?? ""));
  const options = { year: year ?? undefined, month: month ?? undefined };
  const canSensitive = hasPermission(user, "personnel.sensitive.read");
  const buffer = await file.arrayBuffer();

  try {
    if (mode === "preview") {
      const report = await runImport({ type, buffer, mode, ctx: { supabase, projectId, options, canSensitive } });
      return NextResponse.json({ report });
    }

    // commit: keep an audit record + the original file
    const admin = createAdminClient();
    const path = `${projectId}/imports/${randomUUID()}-${slugify(file.name.replace(/\.xlsx$/i, "")).slice(0, 60) || "dosya"}.xlsx`;
    await admin.storage.from("documents").upload(path, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const { data: rec, error: recErr } = await supabase
      .from("imports")
      .insert({ project_id: projectId, kind: type, file_name: file.name, storage_path: path, status: "processing", created_by: user.id })
      .select("id")
      .single();
    if (recErr) return fail(recErr.message, 500);

    let report;
    try {
      report = await runImport({ type, buffer, mode, ctx: { supabase, projectId, importId: rec.id, options, canSensitive, fileName: file.name, storagePath: path, userId: user.id } });
    } catch (e) {
      await supabase.from("imports").update({ status: "failed", errors: [{ error: e instanceof Error ? e.message : String(e) }], completed_at: new Date().toISOString() }).eq("id", rec.id);
      throw e;
    }
    await supabase
      .from("imports")
      .update({
        status: "completed",
        total_rows: report.total,
        success_rows: report.applied ?? 0,
        error_rows: report.failed,
        errors: report.rows.filter((r) => r.errors.length).slice(0, 200).map((r) => ({ row: r.row, title: r.title, errors: r.errors })),
        completed_at: new Date().toISOString(),
      })
      .eq("id", rec.id);
    return NextResponse.json({ report });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Dosya işlenemedi.");
  }
}
