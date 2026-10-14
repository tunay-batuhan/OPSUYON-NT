import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td } from "@/components/ui";
import { CustomerUserForm, StaffUserForm } from "@/components/forms/user-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Organization, Profile, Role } from "@/lib/types";

export const metadata: Metadata = { title: "Kullanıcılar & hesaplar" };

type Row = Profile & { organizations: { name: string } | null; roles: { name: string } | null };

export default async function UsersPage({ searchParams }: PageProps<"/merkez/kullanicilar">) {
  const user = await requireStaff("users.read");
  const sp = await searchParams;
  const defaultOrgId = typeof sp.firma === "string" ? sp.firma : undefined;
  const supabase = await createClient();
  const [{ data }, { data: orgs }, { data: roles }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("*, organizations(name), roles:staff_role_id(name)").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name").neq("status", "archived").order("name"),
    supabase.from("roles").select("id, code, name, scope").order("name"),
    supabase.from("projects").select("id, name, organization_id").neq("status", "closed").order("name"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const manage = hasPermission(user, "users.manage");
  const allRoles = (roles ?? []) as Pick<Role, "id" | "code" | "name" | "scope">[];
  const staffRoles = allRoles.filter((r) => r.scope === "staff" && (r.code !== "super_admin" || user.roleCode === "super_admin"));
  const customerRoles = allRoles.filter((r) => r.scope === "customer");
  const orgList = (orgs ?? []) as Pick<Organization, "id" | "name">[];

  return (
    <>
      <PageHeader
        title="Kullanıcılar & hesaplar"
        description="Firmaları ve hesapları yalnızca merkez tanımlar. Müşteri, kendisine tanımlanan kullanıcı adı ve parola ile aynı giriş ekranından girer; yetkisi olan ekranlar otomatik açılır."
      />
      <div className="space-y-6">
        {manage && (
          <Card id="yeni">
            <CardHeader
              title="Müşteri hesabı aç"
              description="1) Firmayı seçin  2) Erişeceği projeleri işaretleyin  3) Oluşan kullanıcı adı ve parolayı müşteriye iletin."
            />
            {orgList.length === 0 ? (
              <div className="p-5">
                <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
                  Müşteri hesabı açmadan önce bir firma eklemelisiniz.{" "}
                  <Link href="/merkez/firmalar#yeni" className="font-medium underline">Firma ekle</Link>
                </p>
              </div>
            ) : (
              <CustomerUserForm
                orgs={orgList.map((o) => ({ value: o.id, label: o.name }))}
                projects={((projects ?? []) as { id: string; name: string; organization_id: string }[]).map((p) => ({ value: p.id, label: p.name, organization_id: p.organization_id }))}
                customerRoles={customerRoles.map((r) => ({ value: r.id, label: r.name }))}
                defaultRoleId={customerRoles.find((r) => r.code === "customer_manager")?.id}
                defaultOrgId={defaultOrgId}
              />
            )}
          </Card>
        )}

        {manage && user.roleCode === "super_admin" && (
          <Card id="merkez">
            <CardHeader title="Merkez personeli ekle" description="Her merkez kullanıcısına ayrı yetki verebilirsiniz: hesabı açtıktan sonra kullanıcı sayfasından tek tek izin verin veya engelleyin." />
            <StaffUserForm staffRoles={staffRoles.map((r) => ({ value: r.id, label: r.name }))} />
          </Card>
        )}

        <Card>
          <CardHeader title="Mevcut hesaplar" description={`${rows.length} kullanıcı`} />
          {rows.length === 0 ? (
            <EmptyState title="Kullanıcı yok" />
          ) : (
            <Table head={["Kullanıcı", "Tür", "Firma / rol", "Son giriş", "Durum"]}>
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-surface-2">
                  <td className={td}>
                    <Link href={`/merkez/kullanicilar/${u.id}`} className="font-medium hover:text-brand">{u.full_name}</Link>
                    <p className="text-xs text-muted">@{u.username}</p>
                  </td>
                  <td className={td}><Badge tone={u.kind === "staff" ? "brand" : "neutral"}>{u.kind === "staff" ? "Merkez" : "Müşteri"}</Badge></td>
                  <td className={td}>{u.kind === "staff" ? u.roles?.name : u.organizations?.name}</td>
                  <td className={td}>{formatDateTime(u.last_login_at)}</td>
                  <td className={td}><Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Aktif" : "Kısıtlı"}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
