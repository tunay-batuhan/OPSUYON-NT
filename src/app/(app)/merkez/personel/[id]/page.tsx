import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { DeletePersonnelButton, PersonnelEditForm } from "@/components/forms/admin-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { Personnel } from "@/lib/types";

const marital = { bekar: "Bekar", evli: "Evli" } as const;

/** Personel detayı › Personel kartı sekmesi (başlık ve sekmeler layout.tsx'te). */
export default async function PersonnelCardPage({ params }: PageProps<"/merkez/personel/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("personnel.read");
  const supabase = await createClient();

  const sensitive = hasPermission(user, "personnel.sensitive.read");
  const manage = hasPermission(user, "personnel.manage");
  const [lines, { data: person }, priv, { data: orgRows }, { data: asg }] = await Promise.all([
    getServiceLines(),
    supabase.from("personnel").select("*").eq("id", id).maybeSingle(),
    sensitive ? supabase.from("personnel_private").select("national_id, iban").eq("personnel_id", id).maybeSingle() : null,
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("personnel_assignments").select("end_date").eq("personnel_id", id),
  ]);
  if (!person) notFound();
  const p = person as Personnel;
  const orgs = (orgRows ?? []) as { id: string; name: string }[];
  // Firmalar arası geçiş: aktif görev varken olmaz; geçmiş görevi olan personeli yalnızca Süper Yönetici geçirir
  const assignments = (asg ?? []) as { end_date: string | null }[];
  const orgChange = assignments.some((a) => !a.end_date) ? "active" : assignments.length === 0 ? "free" : user.roleCode === "super_admin" ? "super" : "locked";

  const sizes = [
    p.pants_size && `Pantolon ${p.pants_size}`,
    p.shirt_size && `Gömlek ${p.shirt_size}`,
    p.coat_size && `Mont ${p.coat_size}`,
    p.shoe_size && `Ayakkabı ${p.shoe_size}`,
  ].filter(Boolean).join(" · ");

  if (!manage) {
    return (
      <Card>
        <CardHeader title="Bilgiler" />
        <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
          <Item label="Telefon" value={p.phone} />
          <Item label="E-posta" value={p.email} />
          <Item label="İşe giriş" value={formatDate(p.hire_date)} />
          <Item label="Doğum tarihi" value={formatDate(p.birth_date)} />
          <Item label="Doğum yeri" value={p.birth_place} />
          <Item label="Memleketi" value={p.hometown} />
          <Item label="Medeni hali" value={p.marital_status ? marital[p.marital_status] : null} />
          <Item label="Yedek telefon" value={[p.emergency_phone, p.emergency_contact_name].filter(Boolean).join(" — ")} />
          <Item label="Adres" value={p.address} />
          <Item label="Boy / kilo" value={[p.height_cm && `${p.height_cm} cm`, p.weight_kg && `${p.weight_kg} kg`].filter(Boolean).join(" · ")} />
          <Item label="Beden ölçüleri" value={sizes} />
          {sensitive && (
            <>
              <Item label="TC kimlik no" value={priv?.data?.national_id} mono />
              <Item label="IBAN" value={priv?.data?.iban} mono />
            </>
          )}
        </dl>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Personel kartı" description="Bilgileri düzenleyebilirsiniz. Ayrılan personel için durumu 'Ayrıldı' yapın." />
        <PersonnelEditForm
          person={{ ...p, national_id: priv?.data?.national_id ?? null, iban: priv?.data?.iban ?? null }}
          lines={lines.map((l) => ({ value: l.code, label: l.name }))}
          orgs={orgs.map((o) => ({ value: o.id, label: o.name }))}
          canSensitive={sensitive}
          orgChange={orgChange}
        />
      </Card>
      <Card>
        <CardHeader title="Kartı sil" description="Yalnızca hiç işlem kaydı (atama, puantaj, izin, vardiya, belge) olmayan personel silinebilir." />
        <div className="p-5">
          <DeletePersonnelButton id={p.id} name={p.full_name} />
        </div>
      </Card>
    </div>
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
