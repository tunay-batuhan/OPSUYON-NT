import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState, Table, td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Firma hesapları" };

/** Firma detayı › Hesaplar sekmesi. */
export default async function OrganizationUsersPage({ params }: PageProps<"/merkez/firmalar/[id]/hesaplar">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireStaff("organizations.read");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, username, full_name, is_active, last_login_at").eq("organization_id", id).order("full_name");
  const usr = (data ?? []) as Pick<Profile, "id" | "username" | "full_name" | "is_active" | "last_login_at">[];

  return (
    <Card>
      <CardHeader title="Hesaplar" description={`${usr.length} kullanıcı`} />
      {usr.length === 0 ? (
        <EmptyState title="Bu firmaya ait hesap yok" />
      ) : (
        <Table head={["Kullanıcı", "Son giriş", "Durum"]}>
          {usr.map((u) => (
            <tr key={u.id}>
              <td className={td}><Link href={`/merkez/kullanicilar/${u.id}`} className="font-medium hover:text-brand">{u.full_name}</Link><p className="text-xs text-muted">@{u.username}</p></td>
              <td className={td}>{formatDateTime(u.last_login_at)}</td>
              <td className={td}><Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Aktif" : "Kısıtlı"}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
