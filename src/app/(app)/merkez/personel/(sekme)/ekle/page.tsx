import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui";
import { PersonnelForm } from "@/components/forms/admin-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Personel ekle" };

export default async function AddPersonnelPage() {
  const user = await requireStaff("personnel.manage");
  const supabase = await createClient();
  const [lines, { data: orgRows }] = await Promise.all([getServiceLines(), supabase.from("organizations").select("id, name").order("name")]);
  const orgs = (orgRows ?? []) as { id: string; name: string }[];

  return (
    <>
      <Card>
        <CardHeader
          title="Yeni personel"
          description={
            hasPermission(user, "leaves.manage")
              ? "İşe giriş tarihi girilirse bu yılın yasal yıllık izin hakkı (İş Kanunu md. 53) izin bakiyesine otomatik yazılır."
              : undefined
          }
        />
        <PersonnelForm
          lines={lines.map((l) => ({ value: l.code, label: l.name }))}
          orgs={orgs.map((o) => ({ value: o.id, label: o.name }))}
          canSensitive={hasPermission(user, "personnel.sensitive.read")}
        />
      </Card>
    </>
  );
}
