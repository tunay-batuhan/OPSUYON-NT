import { CalendarDays, FileText, Users, Wallet } from "lucide-react";
import { Card, CardHeader, Notice, Stat } from "@/components/ui";
import { ProjectEditForm } from "@/components/forms/admin-forms";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { can, getProjectContext } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { StatementRow } from "@/lib/types";

export default async function ProjectOverview({ params, searchParams }: PageProps<"/projeler/[id]">) {
  const { id } = await params;
  const granted = Number((await searchParams).erisim) || 0;
  const ctx = await getProjectContext(id);
  const { project } = ctx;
  const supabase = await createClient();

  const [personnel, lastSheet, docs, ledger] = await Promise.all([
    can(ctx, "personnel.read")
      ? supabase.from("personnel_assignments").select("id", { count: "exact", head: true }).eq("project_id", id).is("end_date", null)
      : null,
    can(ctx, "timesheets.read")
      ? supabase.from("timesheets").select("period_year, period_month").eq("project_id", id)
          .order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(1).maybeSingle()
      : null,
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("project_id", id),
    can(ctx, "ledger.read") ? supabase.rpc("account_statement", { p_project_id: id }) : null,
  ]);

  const statement = (ledger?.data as StatementRow[] | null) ?? [];
  const balance = statement.at(-1)?.balance ?? 0;
  const canEdit = can(ctx, "projects.manage");

  return (
    <div className="space-y-6">
      {granted > 0 && (
        <Notice tone="success">
          Proje oluşturuldu. Firmanın {granted} “Firma Yöneticisi” hesabına bu projeye erişim otomatik verildi; diğer hesaplara Kullanıcılar sayfasından erişim verebilirsiniz.
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {personnel && <Stat label="Aktif personel" value={personnel.count ?? 0} icon={Users} />}
        {lastSheet && (
          <Stat
            label="Son puantaj dönemi"
            value={lastSheet.data ? formatPeriod(lastSheet.data.period_year, lastSheet.data.period_month) : "—"}
            icon={CalendarDays}
          />
        )}
        <Stat label="Erişilebilir belge" value={docs.count ?? 0} icon={FileText} />
        {ledger && (
          <Stat
            label="Cari bakiye"
            value={formatMoney(balance)}
            hint={balance > 0 ? "Ödenecek tutar" : balance < 0 ? "Alacak" : "Bakiye yok"}
            icon={Wallet}
          />
        )}
      </div>

      <Card>
        <CardHeader title="Proje bilgileri" />
        <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
          <Info label="Firma" value={project.organizations?.name} />
          <Info label="Proje kodu" value={project.code} />
          <Info label="Başlangıç" value={formatDate(project.start_date)} />
          <Info label="Bitiş" value={formatDate(project.end_date)} />
          <Info label="Adres" value={project.address} className="sm:col-span-2" />
          {project.notes && <Info label="Notlar" value={project.notes} className="sm:col-span-2" />}
        </dl>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader title="Projeyi düzenle" description="Yalnızca merkez yetkilileri görür." />
          <ProjectEditForm project={project} />
        </Card>
      )}
    </div>
  );
}

function Info({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}
