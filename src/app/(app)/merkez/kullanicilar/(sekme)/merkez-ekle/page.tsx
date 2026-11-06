import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { StaffUserForm } from "@/components/forms/user-forms";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const metadata: Metadata = { title: "Merkez personeli ekle" };

/** Merkez kullanıcısını yalnızca süper yönetici açar. */
export default async function StaffUserAddPage() {
  const user = await requireStaff("users.manage");
  if (user.roleCode !== "super_admin") notFound();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("roles").select("id, code, name, scope").eq("scope", "staff").order("name");
  const staffRoles = (roles ?? []) as Pick<Role, "id" | "code" | "name" | "scope">[];

  return (
    <>
      <Card>
        <CardHeader title="Merkez personeli ekle" description="Her merkez kullanıcısına ayrı yetki verebilirsiniz: hesabı açtıktan sonra kullanıcı sayfasından tek tek izin verin veya engelleyin." />
        <StaffUserForm staffRoles={staffRoles.map((r) => ({ value: r.id, label: r.name }))} />
      </Card>
    </>
  );
}
