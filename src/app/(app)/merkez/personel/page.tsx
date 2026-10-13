import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, inputCls, td } from "@/components/ui";
import { PersonnelForm } from "@/components/forms/admin-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { Personnel } from "@/lib/types";

export const metadata: Metadata = { title: "Personel" };

const tone = { active: "success", passive: "warning", terminated: "neutral" } as const;
const label = { active: "Aktif", passive: "Pasif", terminated: "Ayrıldı" } as const;

export default async function PersonnelPage({ searchParams }: PageProps<"/merkez/personel">) {
  const user = await requireStaff("personnel.read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();

  let query = supabase.from("personnel").select("*").order("full_name").limit(300);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data }, lines] = await Promise.all([query, getServiceLines()]);
  const list = (data ?? []) as Personnel[];
  const manage = hasPermission(user, "personnel.manage");
  const sensitive = hasPermission(user, "personnel.sensitive.read");

  return (
    <>
      <PageHeader title="Personel" description="Merkezin personel havuzu. Projelere atamalar proje sayfasından yapılır." />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title={`${list.length} kayıt`}
            action={
              <form method="get" className="flex gap-2">
                <input name="q" defaultValue={q} placeholder="İsim ara…" className={inputCls + " h-9 w-48"} aria-label="İsim ara" />
                <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-surface-2">Ara</button>
              </form>
            }
          />
          {list.length === 0 ? (
            <EmptyState title="Personel bulunamadı" />
          ) : (
            <Table head={["Ad soyad", "Sicil", "Ünvan", "Hizmet alanı", "İşe giriş", "Durum"]}>
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2">
                  <td className={td}><Link href={`/merkez/personel/${p.id}`} className="font-medium hover:text-brand">{p.full_name}</Link></td>
                  <td className={td}>{p.employee_no ?? "—"}</td>
                  <td className={td}>{p.title ?? "—"}</td>
                  <td className={td}>{lines.find((l) => l.code === p.service_line)?.name ?? "—"}</td>
                  <td className={td}>{formatDate(p.hire_date)}</td>
                  <td className={td}><Badge tone={tone[p.status]}>{label[p.status]}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {manage && (
          <Card id="yeni">
            <CardHeader title="Yeni personel" />
            <PersonnelForm lines={lines.map((l) => ({ value: l.code, label: l.name }))} canSensitive={sensitive} />
          </Card>
        )}
      </div>
    </>
  );
}
