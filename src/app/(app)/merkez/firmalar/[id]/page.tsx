import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { OrganizationEditForm } from "@/components/forms/admin-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setOrganizationStatus } from "@/app/actions/projects";
import type { Organization } from "@/lib/types";

/** Firma detayı › Firma bilgileri sekmesi (başlık ve sekmeler layout.tsx'te). */
export default async function OrganizationInfoPage({ params }: PageProps<"/merkez/firmalar/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("organizations.read");
  const manage = hasPermission(user, "organizations.manage");
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  if (!org) notFound();
  const o = org as Organization;

  if (!manage) {
    return (
      <Card>
        <CardHeader title="Firma bilgileri" />
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          {([["Vergi dairesi", o.tax_office], ["Vergi no", o.tax_no], ["Telefon", o.phone], ["E-posta", o.email], ["Adres", o.address]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>
          ))}
        </dl>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Firma bilgileri"
        description="Vergi dairesi, vergi no, adres ve telefon zorunludur."
        action={
          <form action={setOrganizationStatus} className="flex gap-3 text-sm">
            <input type="hidden" name="id" value={o.id} />
            {o.status !== "active" && <button name="status" value="active" className="font-medium text-brand hover:underline">Aktifleştir</button>}
            {o.status === "active" && <button name="status" value="suspended" className="font-medium text-warning hover:underline">Askıya al</button>}
            {o.status !== "archived" && <button name="status" value="archived" className="text-muted hover:underline">Arşivle</button>}
          </form>
        }
      />
      <OrganizationEditForm org={o} />
    </Card>
  );
}
