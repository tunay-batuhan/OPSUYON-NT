import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, Table, td, tdNum } from "@/components/ui";
import { PATROL_LINES } from "../noktalar/lines";
import { requireStaff } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getAccessibleProjects } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { generateProjectPin, removeProjectPin } from "@/app/actions/patrol";

export const metadata: Metadata = { title: "Proje PIN'leri" };

/**
 * Merkez: her devriye projesine tek bir 4 haneli PIN verir ve görevlilerle paylaşır. Görevli QR'ı okutup bu PIN'i
 * girer, sonra projenin personel listesinden kendi adını seçer. PIN'i olmayan projede okutma yapılamaz.
 */
export default async function PatrolPinsPage() {
  await requireStaff("patrol.manage");
  await requireModule("devriye");

  const supabase = await createClient();
  const projects = (await getAccessibleProjects()).filter((p) => PATROL_LINES.includes(p.service_line) && p.status !== "closed");
  const ids = projects.map((p) => p.id);
  const [{ data: pins }, { data: points }] = ids.length
    ? await Promise.all([
        supabase.from("patrol_pins").select("project_id, pin").in("project_id", ids),
        supabase.from("patrol_points").select("project_id").eq("is_active", true).in("project_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const pinOf = new Map((pins ?? []).map((p) => [p.project_id as string, p.pin as string]));
  const pointCount = new Map<string, number>();
  for (const p of points ?? []) pointCount.set(p.project_id as string, (pointCount.get(p.project_id as string) ?? 0) + 1);
  // noktası olan projeler üstte
  const rows = [...projects].sort((a, b) => Number(pointCount.has(b.id)) - Number(pointCount.has(a.id)) || a.name.localeCompare(b.name, "tr"));

  return (
    <Card>
      <CardHeader title={`${projects.length} proje`} description="Güvenlik, Danışma ve Tesis Yönetimi projeleri. PIN'i görevlilerle paylaşın; değiştirdiğinizde eskisi hemen geçersiz olur." />
      {rows.length === 0 ? (
        <EmptyState title="Devriye için uygun proje yok" description="Devriye; Güvenlik, Danışma ve Tesis Yönetimi projelerinde kullanılır." />
      ) : (
        <Table numeric={[2]} head={["Proje", "Firma", "Aktif nokta", "PIN", ""]}>
          {rows.map((p) => {
            const pin = pinOf.get(p.id);
            return (
              <tr key={p.id}>
                <td className={td + " font-medium"}>{p.name}</td>
                <td className={td + " text-muted"}>{p.organizations?.name ?? "—"}</td>
                <td className={tdNum}>{pointCount.get(p.id) ?? 0}</td>
                <td className={td}>
                  {pin ? <span className="font-mono text-base font-semibold tracking-[0.3em] tabular-nums">{pin}</span> : <Badge tone="warning">PIN yok</Badge>}
                </td>
                <td className={td + " whitespace-nowrap text-right"}>
                  <form action={generateProjectPin} className="mr-3 inline">
                    <input type="hidden" name="project_id" value={p.id} />
                    <button className="text-sm font-medium text-brand hover:underline">{pin ? "PIN'i değiştir" : "PIN oluştur"}</button>
                  </form>
                  {pin && (
                    <form action={removeProjectPin} className="inline">
                      <input type="hidden" name="project_id" value={p.id} />
                      <button className="text-sm text-danger hover:underline">Kaldır</button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </Card>
  );
}
