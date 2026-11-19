import { NextResponse, type NextRequest } from "next/server";
import { canAnywhere, getCurrentUser } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/lookups";
import { getEnabledModules } from "@/lib/modules";
import { formatDate } from "@/lib/format";
import { loadReport, logFiltersFrom, STATUS_OPTIONS } from "@/lib/visitors";
import { buildVisitorReportPdf } from "@/lib/pdf/visitors-pdf";

/**
 * Ziyaretçi ve kargo raporu (PDF), ekrandaki süzgeçlerle (proje, tarih aralığı, tür, durum, arama). Kayıtlar kullanıcı
 * oturumuyla okunur: RLS yalnızca visitors.read yetkisi olan projeleri döndürür. Personel hesabı alamaz.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.kind === "personnel" || !canAnywhere(user, "visitors.read")) return new NextResponse("Not found", { status: 404 });
  if (user.kind === "customer" && !(await getEnabledModules()).has("ziyaretci")) return new NextResponse("Not found", { status: 404 });
  const f = logFiltersFrom(Object.fromEntries(req.nextUrl.searchParams));
  const [rows, projects] = await Promise.all([loadReport(f), getAccessibleProjects()]);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const filters: [string, string][] = [
    ["Tarih", f.from === f.to ? formatDate(f.from) : `${formatDate(f.from)} – ${formatDate(f.to)}`],
    ...(f.projectId ? [["Proje", projectName.get(f.projectId) ?? "—"] as [string, string]] : projects.length > 1 ? [["Proje", "Tüm projeler"] as [string, string]] : []),
    ...(f.kind ? [["Tür", f.kind === "kargo" ? "Kargo / teslimat" : "Ziyaretçi"] as [string, string]] : []),
    ...(f.status ? [["Durum", STATUS_OPTIONS.find((o) => o.value === f.status)?.label ?? ""] as [string, string]] : []),
    ...(f.q ? [["Arama", f.q] as [string, string]] : []),
  ];
  const pdf = await buildVisitorReportPdf({ rows, filters, multiProject: !f.projectId && projects.length > 1, projectName, truncated: rows.length >= 5000 });
  const name = `ziyaretci-raporu-${f.from}${f.to !== f.from ? `_${f.to}` : ""}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
