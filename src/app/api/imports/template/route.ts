import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { buildTemplate } from "@/lib/import/engine";
import { IMPORT_DEFS, type ImportType } from "@/lib/import/defs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.kind !== "staff" || !hasPermission(user, "imports.manage")) {
    return new NextResponse("Yetkisiz", { status: 403 });
  }
  const type = req.nextUrl.searchParams.get("type") as ImportType;
  if (!IMPORT_DEFS[type]) return new NextResponse("Geçersiz tür", { status: 400 });

  const buf = await buildTemplate(type);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="opsuyon-${type}-sablon.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
