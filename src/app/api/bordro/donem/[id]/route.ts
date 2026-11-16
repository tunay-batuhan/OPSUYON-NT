import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadPayrollRun } from "@/lib/payroll";
import { fileSafe, periodLabel } from "@/lib/payroll-shared";
import { buildPayrollXlsx } from "@/lib/payroll-xlsx";
import { buildPayrollListPdf } from "@/lib/pdf/payroll-pdf";
import { createClient } from "@/lib/supabase/server";

/**
 * Dönemin toplu bordrosu: ?format=pdf (A4 yatay liste, varsayılan) | xlsx (müşterinin Excel düzeni).
 * Dönem ve satırlar kullanıcı oturumuyla okunur → RLS (payroll.read / payroll.run).
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/bordro/donem/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user || user.kind === "personnel") return new NextResponse("Not found", { status: 404 });

  const run = await loadPayrollRun(await createClient(), id);
  if (!run) return new NextResponse("Not found", { status: 404 });

  const base = `maas-bordrosu-${fileSafe(run.org || run.project)}-${fileSafe(periodLabel(run.year, run.month))}`;
  if (req.nextUrl.searchParams.get("format") === "xlsx") {
    const buf = await buildPayrollXlsx(run);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await buildPayrollListPdf(run);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("goster") ? "inline" : "attachment"}; filename="${base}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
