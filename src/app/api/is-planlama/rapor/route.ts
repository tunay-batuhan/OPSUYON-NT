import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, canAnywhere } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { getAccessibleProjects } from "@/lib/lookups";
import { formatDate } from "@/lib/format";
import { loadTaskCounts, loadTasks, taskFiltersFrom, TASK_SCOPE_LABELS } from "@/lib/task-data";
import { buildTaskReportPdf } from "@/lib/pdf/tasks-pdf";

const STAGE_LABEL: Record<string, string> = {
  acik: "Açık görevler", bekleyen: "Onay bekleyen", tarih: "Tarih bekleyen", planlanan: "Planlanan", sorun: "Sorun bildirilen",
  bitirdi: "Personel bitirdi", tamam: "Tamamlanan", iptal: "İptal",
};
const MAX = 1000;

/** İş Planlama listesinin PDF'i: ekrandaki süzgeçlerle (proje, ad, görevi, tarih aralığı, durum). Satırları RLS süzer. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  // merkez kullanıcısı her zaman: saha görevlerini göremese de kendisine atananların raporunu alabilir (RLS süzer)
  if (!user || (user.kind !== "staff" && !canAnywhere(user, "tasks.read"))) return new NextResponse("Not found", { status: 404 });
  if (user.kind === "customer" && !(await getEnabledModules()).has("is_planlama")) return new NextResponse("Not found", { status: 404 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = taskFiltersFrom(sp, user);
  const staffView = f.scope === "merkez" || f.scope === "bana";
  const [{ rows, total }, counts, projects] = await Promise.all([loadTasks(f, { from: 0, to: MAX - 1 }), loadTaskCounts(f), getAccessibleProjects()]);

  const filters: [string, string][] = [
    ...(staffView
      ? ([["Tür", TASK_SCOPE_LABELS[f.scope!]]] as [string, string][])
      : ([["Proje", f.projectId ? (projects.find((p) => p.id === f.projectId)?.name ?? "—") : projects.length > 1 ? "Tüm projeler" : (projects[0]?.name ?? "—")]] as [string, string][])),
    ...(f.name && f.scope !== "bana" ? ([[staffView ? "Kullanıcı" : "Personel", f.name]] as [string, string][]) : []),
    ...(f.job ? ([["Görevi", f.job]] as [string, string][]) : []),
    ...(f.from ? ([["Tarih aralığı", `${formatDate(f.from)} – ${formatDate(f.to ?? f.from)}`]] as [string, string][]) : []),
    ...(f.stage ? ([["Durum", STAGE_LABEL[f.stage] ?? f.stage]] as [string, string][]) : []),
  ];
  const pdf = await buildTaskReportPdf({ rows, counts, filters, multiProject: projects.length > 1 && !f.projectId && !staffView, staffView, truncated: total > MAX });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="is-planlama-${day}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
