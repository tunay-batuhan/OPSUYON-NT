import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState, Table, cn, inputCls, td, tdNum } from "@/components/ui";
import { TimesheetForm } from "@/components/forms/ops-forms";
import { MONTHS, formatNumber } from "@/lib/format";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  personnel_id: string;
  worked_days: number;
  leave_days: number;
  absence_days: number;
  overtime_hours: number;
  note: string | null;
  personnel: { full_name: string } | null;
};

export default async function TimesheetsPage({ params, searchParams }: PageProps<"/projeler/[id]/puantaj">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(id);
  if (!can(ctx, "timesheets.read")) notFound();

  const supabase = await createClient();
  const now = new Date();
  const year = Number(typeof sp.yil === "string" ? sp.yil : now.getFullYear());
  const month = Number(typeof sp.ay === "string" ? sp.ay : now.getMonth() + 1);

  const { data } = await supabase
    .from("timesheets")
    .select("id, personnel_id, worked_days, leave_days, absence_days, overtime_hours, note, personnel(full_name)")
    .eq("project_id", id)
    .eq("period_year", year)
    .eq("period_month", month);
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    (a.personnel?.full_name ?? "").localeCompare(b.personnel?.full_name ?? "", "tr"),
  );

  const manage = can(ctx, "timesheets.manage");
  const people = manage
    ? ((
        await supabase
          .from("personnel_assignments")
          .select("personnel(id, full_name)")
          .eq("project_id", id)
          .is("end_date", null)
      ).data ?? []) as unknown as { personnel: { id: string; full_name: string } | null }[]
    : [];

  const total = rows.reduce(
    (a, r) => ({
      worked: a.worked + Number(r.worked_days),
      leave: a.leave + Number(r.leave_days),
      absence: a.absence + Number(r.absence_days),
      ot: a.ot + Number(r.overtime_hours),
    }),
    { worked: 0, leave: 0, absence: 0, ot: 0 },
  );

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={`${MONTHS[month - 1]} ${year} puantajı`}
          action={
            <form className="flex items-center gap-2" method="get">
              <select name="ay" defaultValue={month} className={cn(inputCls, "h-9 w-auto")} aria-label="Ay">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select name="yil" defaultValue={year} className={cn(inputCls, "h-9 w-auto")} aria-label="Yıl">
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-surface-2">Göster</button>
            </form>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title="Bu dönem için puantaj girilmemiş"
            description="Puantaj dosyalarını Belgeler sekmesinden de indirebilirsiniz."
            action={<Link href={`/projeler/${id}/belgeler?kategori=puantaj`} className="text-sm font-medium text-brand">Puantaj belgelerine git</Link>}
          />
        ) : (
          <Table head={["Personel", "Çalışılan gün", "İzin", "Devamsızlık", "Fazla mesai (sa)", "Not"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, "font-medium")}>{r.personnel?.full_name}</td>
                <td className={tdNum}>{formatNumber(r.worked_days)}</td>
                <td className={tdNum}>{formatNumber(r.leave_days)}</td>
                <td className={tdNum}>{formatNumber(r.absence_days)}</td>
                <td className={tdNum}>{formatNumber(r.overtime_hours)}</td>
                <td className={cn(td, "text-muted")}>{r.note ?? ""}</td>
              </tr>
            ))}
            <tr className="bg-surface-2 font-medium">
              <td className={td}>Toplam</td>
              <td className={tdNum}>{formatNumber(total.worked)}</td>
              <td className={tdNum}>{formatNumber(total.leave)}</td>
              <td className={tdNum}>{formatNumber(total.absence)}</td>
              <td className={tdNum}>{formatNumber(total.ot)}</td>
              <td className={td} />
            </tr>
          </Table>
        )}
      </Card>

      {manage && (
        <Card>
          <CardHeader title="Puantaj gir / güncelle" description="Aynı personel ve dönem için kayıt varsa güncellenir." />
          <TimesheetForm
            key={`${year}-${month}`}
            projectId={id}
            year={year}
            month={month}
            people={people.flatMap((p) => (p.personnel ? [{ value: p.personnel.id, label: p.personnel.full_name }] : []))}
          />
        </Card>
      )}
    </div>
  );
}
