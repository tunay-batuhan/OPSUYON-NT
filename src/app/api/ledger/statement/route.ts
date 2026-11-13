import { NextResponse, type NextRequest } from "next/server";
import { ledgerReader } from "@/lib/ledger-access";
import { loadLedgerStatement } from "@/lib/ledger-statement";
import { buildLedgerStatementPdf } from "@/lib/pdf/ledger-pdf";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Cari hesap ekstresi (PDF), Cari Hesap ekranındaki seçimle her istekte üretilir.
 *   ?firma=…            → firma (merkez için zorunlu; müşteri her zaman yalnızca kendi firması)
 *   &bas=YYYY-AA-GG&bit=YYYY-AA-GG → dönem (boşsa firmanın ilk hareketinden bugüne)
 *   &tur=fatura|tahsilat → yalnızca bu tür listelenir (devir ve bakiyeler tüm hareketlere göre)
 *   &goster=1 → tarayıcıda aç (indirmek yerine)
 * Yetki: ekranla aynı (ledger.read); satırları RLS süzer.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const user = await ledgerReader();
  if (!user) return new NextResponse("Not found", { status: 404 });

  const asked = q.get("firma") ?? "";
  let orgId: string;
  if (user.kind === "customer") {
    // müşteri başka firmanın ekstresini isteyemez
    if (asked && asked.toLowerCase() !== user.organization_id!.toLowerCase()) return new NextResponse("Not found", { status: 404 });
    orgId = user.organization_id!;
  } else {
    if (!UUID.test(asked)) return new NextResponse("Geçersiz istek", { status: 400 });
    orgId = asked;
  }
  const bas = q.get("bas") ?? "";
  const bit = q.get("bit") ?? "";
  const tur = q.get("tur");

  const s = await loadLedgerStatement(orgId, {
    start: ISO.test(bas) && !Number.isNaN(Date.parse(bas)) ? bas : undefined,
    end: ISO.test(bit) && !Number.isNaN(Date.parse(bit)) ? bit : undefined,
    kind: tur === "fatura" || tur === "tahsilat" ? tur : null,
  });
  if (!s) return new NextResponse("Not found", { status: 404 });

  const pdf = await buildLedgerStatementPdf(s);
  const fileName = `cari-ekstre-${s.start}_${s.end}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${q.get("goster") ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
