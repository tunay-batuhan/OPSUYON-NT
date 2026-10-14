import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td } from "@/components/ui";
import { OrganizationForm } from "@/components/forms/admin-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setOrganizationStatus } from "@/app/actions/projects";
import type { Organization } from "@/lib/types";

export const metadata: Metadata = { title: "Firmalar" };

const tone = { active: "success", suspended: "warning", archived: "neutral" } as const;
const label = { active: "Aktif", suspended: "Askıda", archived: "Arşiv" } as const;

export default async function OrganizationsPage() {
  const user = await requireStaff("organizations.read");
  const supabase = await createClient();
  const [{ data }, { data: userRows }, { data: projectRows }] = await Promise.all([
    supabase.from("organizations").select("*").order("name"),
    supabase.from("profiles").select("organization_id").eq("kind", "customer"),
    supabase.from("projects").select("organization_id"),
  ]);
  const countBy = (rows: { organization_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => r.organization_id && m.set(r.organization_id, (m.get(r.organization_id) ?? 0) + 1));
    return m;
  };
  const userCount = countBy(userRows);
  const projectCount = countBy(projectRows);
  const orgs = (data ?? []) as Organization[];
  const manage = hasPermission(user, "organizations.manage");

  return (
    <>
      <PageHeader title="Firmalar" description="Askıya alınan firmanın kullanıcıları sisteme erişemez." />
      <div className="space-y-6">
        <Card>
          {orgs.length === 0 ? (
            <EmptyState title="Henüz firma yok" />
          ) : (
            <Table head={["Firma", "Projeler", "Hesaplar", "İletişim", "Durum", manage ? "İşlemler" : null].filter((h) => h !== null)}>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className={td}>
                    <Link href={`/merkez/firmalar/${o.id}`} className="font-medium hover:text-brand">{o.name}</Link>
                    {o.legal_name && <p className="text-xs text-muted">{o.legal_name}</p>}
                  </td>
                  <td className={td}>{projectCount.get(o.id) ?? 0}</td>
                  <td className={td}>{userCount.get(o.id) ?? 0}</td>
                  <td className={td}>
                    {o.email ?? "—"}
                    {o.phone && <p className="text-xs text-muted">{o.phone}</p>}
                  </td>
                  <td className={td}><Badge tone={tone[o.status]}>{label[o.status]}</Badge></td>
                  {manage && (
                    <td className={td}>
                      <div className="mb-1 flex gap-3 text-sm">
                        <Link href={`/merkez/firmalar/${o.id}`} className="font-medium text-brand hover:underline">Düzenle</Link>
                        <Link href={`/merkez/projeler?firma=${o.id}#yeni`} className="font-medium text-brand hover:underline">+ Proje</Link>
                        <Link href={`/merkez/kullanicilar?firma=${o.id}#yeni`} className="font-medium text-brand hover:underline">+ Hesap aç</Link>
                      </div>
                      <form action={setOrganizationStatus} className="flex gap-2">
                        <input type="hidden" name="id" value={o.id} />
                        {o.status !== "active" && <button name="status" value="active" className="text-sm text-brand hover:underline">Aktifleştir</button>}
                        {o.status === "active" && <button name="status" value="suspended" className="text-sm text-warning hover:underline">Askıya al</button>}
                        {o.status !== "archived" && <button name="status" value="archived" className="text-sm text-muted hover:underline">Arşivle</button>}
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {manage && (
          <Card id="yeni">
            <CardHeader title="Yeni firma" description="Firmayı ekledikten sonra proje tanımlayın ve müşteri için hesap açın." />
            <OrganizationForm />
          </Card>
        )}
      </div>
    </>
  );
}
