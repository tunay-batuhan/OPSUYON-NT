import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td, tdNum } from "@/components/ui";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/format";
import type { LeaveBalance, Personnel } from "@/lib/types";

type Assignment = {
  id: string;
  position: string | null;
  start_date: string;
  end_date: string | null;
  projects: { id: string; name: string; organizations: { name: string } | null } | null;
};

export default async function PersonnelDetail({ params }: PageProps<"/merkez/personel/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("personnel.read");
  const supabase = await createClient();

  const sensitive = hasPermission(user, "personnel.sensitive.read");
  const [{ data: person }, { data: assignments }, { data: leaves }, priv] = await Promise.all([
    supabase.from("personnel").select("*").eq("id", id).maybeSingle(),
    supabase.from("personnel_assignments").select("id, position, start_date, end_date, projects(id, name, organizations(name))").eq("personnel_id", id).order("start_date", { ascending: false }),
    supabase.from("leave_balances").select("*").eq("personnel_id", id).order("year", { ascending: false }),
    sensitive ? supabase.from("personnel_private").select("*").eq("personnel_id", id).maybeSingle() : null,
  ]);
  if (!person) notFound();
  const p = person as Personnel;
  const rows = (assignments ?? []) as unknown as Assignment[];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/merkez/personel" className="inline-flex items-center gap-1 hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Personel</Link>}
        title={p.full_name}
        description={[p.title, p.employee_no && `Sicil ${p.employee_no}`].filter(Boolean).join(" · ")}
        actions={<Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? "Aktif" : p.status === "passive" ? "Pasif" : "Ayrıldı"}</Badge>}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Bilgiler" />
          <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
            <Item label="Telefon" value={p.phone} />
            <Item label="E-posta" value={p.email} />
            <Item label="İşe giriş" value={formatDate(p.hire_date)} />
            {sensitive && (
              <>
                <Item label="TC kimlik no" value={priv?.data?.national_id} mono />
                <Item label="IBAN" value={priv?.data?.iban} mono />
                <Item label="Doğum tarihi" value={formatDate(priv?.data?.birth_date)} />
              </>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Proje görevlendirmeleri" />
          {rows.length === 0 ? (
            <EmptyState title="Henüz bir projeye atanmamış" />
          ) : (
            <Table head={["Proje", "Firma", "Görev", "Başlangıç", "Bitiş"]}>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className={td}>{a.projects && <Link href={`/projeler/${a.projects.id}/personel`} className="font-medium hover:text-brand">{a.projects.name}</Link>}</td>
                  <td className={td}>{a.projects?.organizations?.name}</td>
                  <td className={td}>{a.position ?? "—"}</td>
                  <td className={td}>{formatDate(a.start_date)}</td>
                  <td className={td}>{a.end_date ? formatDate(a.end_date) : <Badge tone="success">Devam ediyor</Badge>}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Yıllık izin" />
          {(leaves ?? []).length === 0 ? (
            <EmptyState title="İzin kaydı yok" />
          ) : (
            <Table head={["Yıl", "Hak edilen", "Devreden", "Kullanılan", "Kalan"]}>
              {((leaves ?? []) as LeaveBalance[]).map((l) => (
                <tr key={l.id}>
                  <td className={td}>{l.year}</td>
                  <td className={tdNum}>{formatNumber(l.entitled_days)}</td>
                  <td className={tdNum}>{formatNumber(l.carried_days)}</td>
                  <td className={tdNum}>{formatNumber(l.used_days)}</td>
                  <td className={tdNum + " font-semibold"}>{formatNumber(l.remaining_days)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function Item({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className={"mt-0.5 font-medium " + (mono ? "font-mono" : "")}>{value || "—"}</dd>
    </div>
  );
}
