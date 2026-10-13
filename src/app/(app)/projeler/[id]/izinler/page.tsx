import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState, Table, cn, inputCls, td, tdNum } from "@/components/ui";
import { LeaveForm } from "@/components/forms/ops-forms";
import { formatNumber } from "@/lib/format";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  year: number;
  entitled_days: number;
  carried_days: number;
  used_days: number;
  remaining_days: number;
  personnel: { full_name: string } | null;
};

export default async function LeavesPage({ params, searchParams }: PageProps<"/projeler/[id]/izinler">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(id);
  if (!can(ctx, "leaves.read")) notFound();

  const year = Number(typeof sp.yil === "string" ? sp.yil : new Date().getFullYear());
  const supabase = await createClient();

  const { data: assigned } = await supabase
    .from("personnel_assignments")
    .select("personnel(id, full_name)")
    .eq("project_id", id)
    .is("end_date", null);
  const people = ((assigned ?? []) as unknown as { personnel: { id: string; full_name: string } | null }[])
    .map((a) => a.personnel)
    .filter((p): p is { id: string; full_name: string } => Boolean(p));

  const { data } = people.length
    ? await supabase
        .from("leave_balances")
        .select("id, year, entitled_days, carried_days, used_days, remaining_days, personnel(full_name)")
        .in("personnel_id", people.map((p) => p.id))
        .eq("year", year)
    : { data: [] };
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"),
  );
  const manage = can(ctx, "leaves.manage");
  const thisYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={`${year} yıllık izin durumu`}
          action={
            <form method="get" className="flex items-center gap-2">
              <select name="yil" defaultValue={year} className={cn(inputCls, "h-9 w-auto")} aria-label="Yıl">
                {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-surface-2">Göster</button>
            </form>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title="Bu yıl için izin bilgisi girilmemiş" />
        ) : (
          <Table head={["Personel", "Hak edilen", "Devreden", "Kullanılan", "Kalan"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, "font-medium")}>{r.personnel?.full_name}</td>
                <td className={tdNum}>{formatNumber(r.entitled_days)}</td>
                <td className={tdNum}>{formatNumber(r.carried_days)}</td>
                <td className={tdNum}>{formatNumber(r.used_days)}</td>
                <td className={cn(tdNum, "font-semibold", Number(r.remaining_days) < 0 && "text-danger")}>{formatNumber(r.remaining_days)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {manage && (
        <Card>
          <CardHeader title="İzin bakiyesi gir / güncelle" />
          <LeaveForm key={year} projectId={id} year={year} people={people.map((p) => ({ value: p.id, label: p.full_name }))} />
        </Card>
      )}
    </div>
  );
}
