import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { LeaveRecordForm, type LeaveBalanceInfo } from "@/components/forms/leave-forms";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_TYPE_INFO, legalAnnualLeaveDays } from "@/lib/leave-law";
import type { Holiday } from "@/lib/leave-days";

export const metadata: Metadata = { title: "İzin evrakı ekle" };

type AssignmentRow = {
  project_id: string;
  personnel: { id: string; full_name: string; hire_date: string | null } | null;
  projects: { name: string } | null;
};
type BalanceRow = { personnel_id: string; entitled_days: number; carried_days: number; used_days: number; remaining_days: number };

const DEDUCTING = LEAVE_TYPE_INFO.filter((t) => t.deducts).map((t) => t.code);

/** İzin kaydı + imzalı izin evrakı tek formda. Personel seçilince bu yılın kalan yıllık izni görünür. */
export default async function LeaveAddPage() {
  await requireStaff("leaves.manage");
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const [{ data }, { data: bal }, { data: hol }, { data: births }, { data: recs }] = await Promise.all([
    supabase
      .from("personnel_assignments")
      .select("project_id, personnel(id, full_name, hire_date), projects(name)")
      .is("end_date", null)
      .limit(2000),
    supabase.from("leave_balances").select("personnel_id, entitled_days, carried_days, used_days, remaining_days").eq("year", year).limit(5000),
    supabase.from("public_holidays").select("day, name, half").gte("day", `${year - 1}-01-01`).lte("day", `${year + 1}-12-31`).order("day"),
    supabase.from("personnel_personal").select("personnel_id, birth_date").not("birth_date", "is", null).limit(5000),
    supabase.from("leave_records").select("personnel_id, days").in("leave_type", DEDUCTING).gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`).limit(20000),
  ]);

  const rows = ((data ?? []) as unknown as AssignmentRow[]).filter((a) => a.personnel);
  const people = rows
    .map((a) => ({ value: `${a.personnel!.id}|${a.project_id}`, label: `${a.personnel!.full_name} — ${a.projects?.name ?? ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));

  // Kalan yıllık izin: bakiye satırı (hak + devreden − kullanılan) − bu yıl kaydedilen yıllık izinler (diğer ekranlarla aynı hesap)
  const byId = new Map(((bal ?? []) as BalanceRow[]).map((b) => [b.personnel_id, b]));
  const usedByRecords = new Map<string, number>();
  for (const r of recs ?? []) usedByRecords.set(r.personnel_id as string, (usedByRecords.get(r.personnel_id as string) ?? 0) + Number(r.days));
  const birthOf = new Map(((births ?? []) as { personnel_id: string; birth_date: string }[]).map((b) => [b.personnel_id, b.birth_date]));
  const balances: Record<string, LeaveBalanceInfo> = {};
  for (const a of rows) {
    const p = a.personnel!;
    const b = byId.get(p.id);
    const rec = usedByRecords.get(p.id) ?? 0;
    balances[p.id] = b
      ? { year, total: Number(b.entitled_days) + Number(b.carried_days), used: Number(b.used_days) + rec, left: Number(b.remaining_days) - rec }
      : { year, legal: legalAnnualLeaveDays(p.hire_date, birthOf.get(p.id) ?? null), hasHireDate: Boolean(p.hire_date) };
  }

  return (
    <>
      <Card>
        <CardHeader
          title="İzin evrakı ekle"
          description="Personeli ve izin türünü seçin, günü ve başlangıcı girin; son gün ve işe dönüş hesaplanır. Yıllık izinde hafta tatili ve resmi tatiller sayılmaz (öneridir, günü elle değiştirebilirsiniz). Yıllık izin, kalan bakiyeden düşer."
        />
        <LeaveRecordForm people={people} balances={balances} holidays={(hol ?? []) as Holiday[]} />
      </Card>
    </>
  );
}
