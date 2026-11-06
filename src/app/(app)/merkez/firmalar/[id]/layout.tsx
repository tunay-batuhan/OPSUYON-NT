import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, PageHeader, btn } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types";

const tone = { active: "success", suspended: "warning", archived: "neutral" } as const;
const label = { active: "Aktif", suspended: "Askıda", archived: "Arşiv" } as const;

/** Firma detayı: başlık + sekmeler — Firma bilgileri · Projeler · Hesaplar (her sekme tek iş). */
export default async function OrganizationLayout({ params, children }: LayoutProps<"/merkez/firmalar/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("organizations.read");
  const manage = hasPermission(user, "organizations.manage");
  const supabase = await createClient();
  const [{ data }, { count: nProjects }, { count: nUsers }] = await Promise.all([
    supabase.from("organizations").select("id, name, legal_name, status").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", id),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", id),
  ]);
  if (!data) notFound();
  const o = data as Pick<Organization, "id" | "name" | "legal_name" | "status">;
  const base = `/merkez/firmalar/${o.id}`;

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
                <Link href={`/merkez/projeler/ekle?firma=${o.id}`} className={btn("secondary", "sm")}>+ Proje</Link>
                <Link href={`/merkez/kullanicilar/musteri-ekle?firma=${o.id}`} className={btn("primary", "sm")}>+ Hesap aç</Link>
              </>
            )}
          </>
        }
      />
      <Tabs
        items={[
          { href: base, label: "Firma bilgileri", exact: true },
          { href: `${base}/projeler`, label: `Projeler (${nProjects ?? 0})` },
          { href: `${base}/hesaplar`, label: `Hesaplar (${nUsers ?? 0})` },
        ]}
      />
      {children}
    </>
  );
}
