import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { MembershipForm } from "@/components/forms/user-forms";
import { loadUserDetail } from "../data";

export const metadata: Metadata = { title: "Projeye erişim ver" };

/** Kullanıcı detayı › Projeye erişim ver (müşteri; yalnızca kendi firmasının projeleri). */
export default async function UserGrantPage({ params }: PageProps<"/merkez/kullanicilar/[id]/erisim-ver">) {
  const { id } = await params;
  const { u, manage, availableProjects, customerRoles } = await loadUserDetail(id);
  if (u.kind !== "customer" || !manage) notFound();
  return (
    <Card>
      <CardHeader title="Projeye erişim ver" description="Yalnızca kullanıcının firmasına ait projeler listelenir." />
      {availableProjects.length === 0 ? (
        <EmptyState title="Eklenecek proje yok" description="Kullanıcı, firmasının tüm projelerine zaten erişebiliyor." />
      ) : (
        <MembershipForm
          userId={u.id}
          projects={availableProjects.map((p) => ({ value: p.id, label: p.name }))}
          roles={customerRoles.map((r) => ({ value: r.id, label: r.name }))}
          defaultRoleId={customerRoles.find((r) => r.code === "customer_viewer")?.id}
        />
      )}
    </Card>
  );
}
