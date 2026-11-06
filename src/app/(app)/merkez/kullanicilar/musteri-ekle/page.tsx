import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { CustomerUserForm } from "@/components/forms/user-forms";
import { requireStaff } from "@/lib/auth";
import { isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Role } from "@/lib/types";
import { UsersHeader } from "../tabs";

export const metadata: Metadata = { title: "Müşteri hesabı aç" };

export default async function CustomerUserAddPage({ searchParams }: PageProps<"/merkez/kullanicilar/musteri-ekle">) {
  const user = await requireStaff("users.manage");
  const sp = await searchParams;
  const defaultOrgId = isUuid(str1(sp.firma)) ? str1(sp.firma) : undefined;
  const supabase = await createClient();
  const [{ data: orgs }, { data: roles }, { data: projects }] = await Promise.all([
    supabase.from("organizations").select("id, name, status").neq("status", "archived").order("name"),
    supabase.from("roles").select("id, code, name, scope").eq("scope", "customer").order("name"),
    supabase.from("projects").select("id, name, organization_id").neq("status", "closed").order("name"),
  ]);
  // Yeni hesap yalnızca arşivlenmemiş firmaya açılır
  const orgList = (orgs ?? []) as Pick<Organization, "id" | "name" | "status">[];
  const customerRoles = (roles ?? []) as Pick<Role, "id" | "code" | "name" | "scope">[];

  return (
    <>
      <UsersHeader user={user} />
      <Card>
        <CardHeader
          title="Müşteri hesabı aç"
          description="1) Firmayı seçin  2) Erişeceği projeleri işaretleyin  3) Oluşan kullanıcı adı ve parolayı müşteriye iletin."
        />
        {orgList.length === 0 ? (
          <div className="p-5">
            <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
              Müşteri hesabı açmadan önce bir firma eklemelisiniz.{" "}
              <Link href="/merkez/firmalar/ekle" className="font-medium underline">Firma ekle</Link>
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
    </>
  );
}
