import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FilePlus2 } from "lucide-react";
import { Badge, PageHeader, btn } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { hasPermission, requireStaff } from "@/lib/auth";
import { ageOf, legalAnnualLeaveDays, tenureLabel } from "@/lib/leave-law";
import { createClient } from "@/lib/supabase/server";

type Head = {
  id: string; full_name: string; title: string | null; status: string;
  birth_date: string | null; hire_date: string | null; organizations: { name: string } | null;
};

/**
 * Personel detayı: başlık + sekmeler (her sekme tek iş).
 *   Personel kartı · Proje görevlendirmeleri · Evraklar
 */
export default async function PersonnelDetailLayout({ params, children }: LayoutProps<"/merkez/personel/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff("personnel.read");
  const supabase = await createClient();
  const [{ data }, { count: nAssign }, { count: nDocs }] = await Promise.all([
    supabase.from("personnel").select("id, full_name, title, status, birth_date, hire_date, organizations(name)").eq("id", id).maybeSingle(),
    supabase.from("personnel_assignments").select("id", { count: "exact", head: true }).eq("personnel_id", id),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("personnel_id", id),
  ]);
  if (!data) notFound();
  const p = data as unknown as Head;
  const canUpload = hasPermission(user, "documents.manage");

  // başlıktaki kısa bilgi: yaş, çalışma süresi, yasal yıllık izin hakkı (İş K. md. 53)
  const age = ageOf(p.birth_date);
  const tenure = tenureLabel(p.hire_date);
  const leave = legalAnnualLeaveDays(p.hire_date, p.birth_date);
  const summary = [
    p.title,
    p.organizations?.name,
    age !== null ? `${age} yaş` : null,
    tenure ? `Çalışma süresi: ${tenure}` : null,
    p.hire_date ? `Yasal yıllık izin: ${leave.days} gün` : null,
  ].filter(Boolean).join(" · ");
  const base = `/merkez/personel/${p.id}`;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/merkez/personel" className="inline-flex items-center gap-1 hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Personel</Link>}
        title={p.full_name}
        description={summary}
        actions={
          <>
            {canUpload && (
              <Link href={`/merkez/personel/evrak-ekle?personel=${p.id}`} className={btn("secondary", "sm")}>
                <FilePlus2 className="size-4" aria-hidden /> Evrak ekle
              </Link>
            )}
            <Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? "Aktif" : p.status === "passive" ? "Pasif" : "Ayrıldı"}</Badge>
          </>
        }
      />
      <Tabs
        items={[
          { href: base, label: "Personel kartı", exact: true },
          { href: `${base}/gorevler`, label: `Proje görevlendirmeleri (${nAssign ?? 0})` },
          { href: `${base}/evraklar`, label: `Evraklar (${nDocs ?? 0})` },
        ]}
      />
      {children}
    </>
  );
}
