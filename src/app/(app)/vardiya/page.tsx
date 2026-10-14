import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { FilterBar, yearOptions } from "@/components/filter-bar";
import { canAnywhere, requireUser } from "@/lib/auth";
import { getAccessibleProjects, isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { MONTHS } from "@/lib/format";
import { ShiftGrid } from "./shift-grid";

export const metadata: Metadata = { title: "Vardiya Planı" };

export default async function ShiftsPage({ searchParams }: PageProps<"/vardiya">) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(str1(sp.yil) ?? now.getFullYear());
  const month = Number(str1(sp.ay) ?? now.getMonth() + 1);
  const projects = (await getAccessibleProjects()).filter((p) => p.status !== "closed");
  const requested = str1(sp.proje);
  const project = (isUuid(requested) && projects.find((p) => p.id === requested)) || projects[0];

  const header = <PageHeader title="Vardiya Planı" description="Personelin aylık vardiya çizelgesi." />;
  if (!project) {
    return (
      <>
        {header}
        <Card><EmptyState title="Görüntülenecek proje yok" /></Card>
      </>
    );
  }

  const supabase = await createClient();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const [{ data: assigned }, { data: shifts }, { data: types }] = await Promise.all([
    supabase.from("personnel_assignments").select("start_date, end_date, personnel(id, full_name)").eq("project_id", project.id).lte("start_date", to),
    supabase.from("shift_assignments").select("personnel_id, work_date, shift_code").eq("project_id", project.id).gte("work_date", from).lte("work_date", to),
    supabase.from("shift_types").select("code, name, color, is_off, start_time, end_time").eq("is_active", true).order("sort_order"),
  ]);

  const people = new Map<string, { id: string; name: string }>();
  for (const a of (assigned ?? []) as unknown as { start_date: string; end_date: string | null; personnel: { id: string; full_name: string } | null }[]) {
    if (a.personnel && (!a.end_date || a.end_date >= from)) people.set(a.personnel.id, { id: a.personnel.id, name: a.personnel.full_name });
  }
  const peopleList = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const initial: Record<string, string> = {};
  for (const s of shifts ?? []) initial[`${s.personnel_id}|${s.work_date}`] = s.shift_code as string;

  const canEdit = canAnywhere(user, "shifts.manage") && user.kind === "staff";
  const canApply = canEdit && canAnywhere(user, "timesheets.manage");

  return (
    <>
      {header}
      <FilterBar
        action="/vardiya"
        fields={[
          { name: "proje", label: "Proje", value: project.id, options: projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "ay", label: "Ay", value: String(month), options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
          { name: "yil", label: "Yıl", value: String(year), options: yearOptions() },
        ]}
      />
      {peopleList.length === 0 ? (
        <Card><EmptyState title="Bu projede bu ay görevli personel yok" description="Personeli proje sayfasından atayın." /></Card>
      ) : (
        <ShiftGrid
          key={`${project.id}-${year}-${month}`}
          projectId={project.id}
          year={year}
          month={month}
          people={peopleList}
          types={(types ?? []).map((t) => ({ code: t.code as string, name: t.name as string, color: t.color as string, is_off: Boolean(t.is_off), start: t.start_time as string | null, end: t.end_time as string | null }))}
          initial={initial}
          canEdit={canEdit}
          canApplyToTimesheet={canApply}
        />
      )}
    </>
  );
}
