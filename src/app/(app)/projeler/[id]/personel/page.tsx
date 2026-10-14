import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, Table, cn, td } from "@/components/ui";
import { AssignForm } from "@/components/forms/admin-forms";
import { formatDate } from "@/lib/format";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { endAssignment } from "@/app/actions/personnel";

type Row = {
  id: string;
  position: string | null;
  start_date: string;
  end_date: string | null;
  personnel: { id: string; full_name: string; title: string | null; employee_no: string | null; status: string } | null;
};

const FILTERS = [
  { key: "aktif", label: "Aktif" },
  { key: "ayrildi", label: "Ayrılan" },
  { key: "tumu", label: "Tümü" },
] as const;

export default async function ProjectPersonnel({ params, searchParams }: PageProps<"/projeler/[id]/personel">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getProjectContext(id);
  if (!can(ctx, "personnel.read")) notFound();
  const filter = FILTERS.find((f) => f.key === sp.durum)?.key ?? "aktif";

  const supabase = await createClient();
  const { data } = await supabase
    .from("personnel_assignments")
    .select("id, position, start_date, end_date, personnel(id, full_name, title, employee_no, status)")
    .eq("project_id", id)
    .order("end_date", { ascending: false, nullsFirst: true })
    .order("start_date", { ascending: false });
  const all = (data ?? []) as unknown as Row[];
  const activeCount = all.filter((r) => !r.end_date).length;
  const rows = all.filter((r) => (filter === "aktif" ? !r.end_date : filter === "ayrildi" ? Boolean(r.end_date) : true));

  const manage = can(ctx, "personnel.manage");
  const assignedIds = new Set(all.filter((r) => !r.end_date).map((r) => r.personnel?.id));
  const candidates = manage
    ? ((await supabase.from("personnel").select("id, full_name, title").neq("status", "terminated").order("full_name")).data ?? []).filter(
        (p) => !assignedIds.has(p.id),
      )
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Proje personeli"
          description={`${activeCount} aktif · ${all.length - activeCount} ayrılan`}
          action={
            <div className="flex gap-1.5" role="group" aria-label="Durum filtresi">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={`/projeler/${id}/personel?durum=${f.key}`}
                  aria-current={filter === f.key ? "true" : undefined}
                  className={cn("rounded-full border px-3 py-1 text-sm", filter === f.key ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-fg")}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title={filter === "aktif" ? "Bu projede aktif personel yok" : filter === "ayrildi" ? "Ayrılan personel yok" : "Bu projeye atanmış personel yok"} />
        ) : (
          <Table head={["Personel", "Ünvan / görev", "Başlangıç", "Bitiş", "Durum", manage ? "" : null].filter((h) => h !== null)}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <p className="font-medium">
                    {manage && r.personnel ? (
                      <Link href={`/merkez/personel/${r.personnel.id}`} className="hover:text-brand">
                        {r.personnel.full_name}
                      </Link>
                    ) : (
                      r.personnel?.full_name
                    )}
                  </p>
                  {r.personnel?.employee_no && <p className="text-xs text-muted">Sicil: {r.personnel.employee_no}</p>}
                </td>
                <td className={td}>{r.position ?? r.personnel?.title ?? "—"}</td>
                <td className={td}>{formatDate(r.start_date)}</td>
                <td className={td}>{formatDate(r.end_date)}</td>
                <td className={td}>
                  <Badge tone={r.end_date ? "neutral" : "success"}>{r.end_date ? "Ayrıldı" : "Aktif"}</Badge>
                </td>
                {manage && (
                  <td className={td}>
                    {!r.end_date && (
                      <form action={endAssignment}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <button className="text-sm text-danger hover:underline">Görevden al</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {manage && (
        <Card>
          <CardHeader title="Personel ata" description="Merkezdeki personel havuzundan projeye görevlendirin." />
          <AssignForm projectId={id} candidates={candidates.map((p) => ({ value: p.id, label: p.title ? `${p.full_name} — ${p.title}` : p.full_name }))} />
        </Card>
      )}
    </div>
  );
}
