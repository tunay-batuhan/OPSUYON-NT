import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadPayrollRun } from "@/lib/payroll";
import { fileSafe, periodLabel } from "@/lib/payroll-shared";
import { buildPayslipPdf } from "@/lib/pdf/payroll-pdf";
import { createClient } from "@/lib/supabase/server";

/**
 * Bordro pusulası (tek personel, PDF).
 *   Personel hesabı: erişemez (bordro görmez).
 *   Merkez / müşteri: satır kullanıcı oturumuyla okunur → RLS (payroll.read / payroll.run) karar verir.
 *   ?goster=1 → tarayıcıda aç.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/bordro/satir/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // personel hesabı bordro görmez (18 Kasım, müşteri isteği)
  if (user.kind === "personnel") return new NextResponse("Not found", { status: 404 });
  const db = await createClient();
  const { data: row } = await db.from("payroll_lines").select("run_id").eq("id", id).maybeSingle();
  let run = row ? await loadPayrollRun(db, row.run_id) : null;
  if (run) run = { ...run, lines: run.lines.filter((l) => l.id === id) };
  const line = run?.lines[0];
  if (!run || !line) return new NextResponse("Not found", { status: 404 });

  const pdf = await buildPayslipPdf(run, line);
  const fileName = `bordro-${fileSafe(line.full_name)}-${fileSafe(periodLabel(run.year, run.month))}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
