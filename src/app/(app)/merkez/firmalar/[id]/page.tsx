import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, btn, td } from "@/components/ui";
import { OrganizationEditForm } from "@/components/forms/admin-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceLines } from "@/lib/lines";
import { formatDateTime } from "@/lib/format";
import { setOrganizationStatus } from "@/app/actions/projects";
import type { Organization, Profile, Project } from "@/lib/types";

const tone = { active: "success", suspended: "warning", archived: "neutral" } as const;
const label = { active: "Aktif", suspended: "Askıda", archived: "Arşiv" } as const;

export default async function OrganizationDetail({ params }: PageProps<"/merkez/firmalar/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("organizations.read");
  const manage = hasPermission(user, "organizations.manage");
  const supabase = await createClient();

  const [{ data: org }, { data: projects }, { data: users }, lines] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("*").eq("organization_id", id).order("name"),
    supabase.from("profiles").select("id, username, full_name, is_active, last_login_at").eq("organization_id", id).order("full_name"),
    getServiceLines(),
  ]);
  if (!org) notFound();
  const o = org as Organization;
  const prj = (projects ?? []) as Project[];
  const usr = (users ?? []) as Pick<Profile, "id" | "username" | "full_name" | "is_active" | "last_login_at">[];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/merkez/firmalar" className="inline-flex items-center gap-1 hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Firmalar</Link>}
        title={o.name}
        description={o.legal_name ?? undefined}
        actions={
          <>
            <Badge tone={tone[o.status]}>{label[o.status]}</Badge>
            {manage && (
              <>
                <Link href={`/merkez/projeler?firma=${o.id}#yeni`} className={btn("secondary", "sm")}>+ Proje</Link>
                <Link href={`/merkez/kullanicilar?firma=${o.id}#yeni`} className={btn("primary", "sm")}>+ Hesap aç</Link>
              </>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {manage ? (
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
        ) : (
          <Card>
            <CardHeader title="Firma bilgileri" />
            <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              {([["Vergi dairesi", o.tax_office], ["Vergi no", o.tax_no], ["Telefon", o.phone], ["E-posta", o.email], ["Adres", o.address]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>
              ))}
            </dl>
          </Card>
        )}

        <Card>
          <CardHeader title="Projeler" description={`${prj.length} proje`} />
          {prj.length === 0 ? (
            <EmptyState title="Bu firmanın projesi yok" />
          ) : (
            <Table head={["Proje", "Hizmet alanı", "Bitiş", "Durum"]}>
              {prj.map((p) => (
                <tr key={p.id}>
                  <td className={td}><Link href={`/projeler/${p.id}`} className="font-medium hover:text-brand">{p.name}</Link></td>
                  <td className={td}>{lines.find((l) => l.code === p.service_line)?.name ?? p.service_line}</td>
                  <td className={td}>{p.end_date ?? "—"}</td>
                  <td className={td}><Badge tone={p.status === "active" ? "success" : p.status === "paused" ? "warning" : "neutral"}>{p.status === "active" ? "Aktif" : p.status === "paused" ? "Duraklatıldı" : "Pasif"}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

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
      </div>
    </>
  );
}
