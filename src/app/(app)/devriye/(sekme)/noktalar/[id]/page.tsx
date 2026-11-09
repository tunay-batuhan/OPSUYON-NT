import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ChevronLeft, ClipboardList, KeyRound, Printer, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, btn, cn, td } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PatrolPointName, PatrolPointsAddForm } from "@/components/forms/patrol-forms";
import { PATROL_LINES } from "../lines";
import { requireStaff } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getAccessibleProjects } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { PATROL_KEEP_DAYS, fmtDateTime, mapsUrl } from "@/lib/patrol";
import {
  generateProjectPin, movePatrolPoint, removePatrolPoint, removeProjectPin, resetPatrolPointLocation, setPatrolPointActive,
} from "@/app/actions/patrol";

export const metadata: Metadata = { title: "Devriye Noktaları" };

/** Saklama süresinin başı (bu tarihten eski okutmalar silinmiştir). */
const keepSince = () => new Date(Date.now() - PATROL_KEEP_DAYS * 86400000).toISOString();

type Point = { id: string; name: string; code: string; is_active: boolean; lat: number | null; lng: number | null };

const linkBtn = "text-sm font-medium text-brand hover:underline";
const mutedBtn = "text-sm text-muted hover:text-fg hover:underline";

/**
 * Bir projenin devriye yönetimi tek ekranda: üstte nokta ekleme (her satır bir ad) ve proje PIN'i,
 * altta noktalar (adı satırda değiştirilir, sırası oklarla), son okutma, konum, etiket, pasife alma ve silme.
 */
export default async function PatrolProjectPage({ params }: PageProps<"/devriye/noktalar/[id]">) {
  await requireStaff("patrol.manage");
  await requireModule("devriye");
  const { id } = await params;
  const project = (await getAccessibleProjects()).find((p) => p.id === id && PATROL_LINES.includes(p.service_line));
  if (!project) notFound();

  const since = keepSince();
  const supabase = await createClient();
  const [{ data: pointRows }, { data: pinRow }, { data: scans }] = await Promise.all([
    supabase.from("patrol_points").select("id, name, code, is_active, lat, lng").eq("project_id", id).order("sort_order").order("name").order("id"),
    supabase.from("patrol_pins").select("pin").eq("project_id", id).maybeSingle(),
    supabase.from("patrol_scans").select("point_id, scanned_at").eq("project_id", id).gte("scanned_at", since).order("scanned_at", { ascending: false }).limit(5000),
  ]);
  const points = (pointRows ?? []) as Point[];
  const pin = (pinRow?.pin as string | undefined) ?? null;
  const lastScan = new Map<string, string>();
  for (const s of scans ?? []) if (!lastScan.has(s.point_id as string)) lastScan.set(s.point_id as string, s.scanned_at as string);
  const activeCount = points.filter((p) => p.is_active).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/devriye/noktalar" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> Tüm projeler
          </Link>
          <h2 className="mt-1 text-lg font-semibold">{project.name}</h2>
          {project.organizations?.name && <p className="text-sm text-muted">{project.organizations.name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/devriye/rapor?proje=${id}`} className={btn("secondary", "sm")}>
            <ClipboardList className="size-4" aria-hidden /> Okutma kayıtları
          </Link>
          {activeCount > 0 && (
            <Link href={`/devriye/noktalar/yazdir?proje=${id}`} className={btn("primary", "sm")}>
              <Printer className="size-4" aria-hidden /> Tüm etiketleri yazdır ({activeCount})
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Nokta ekle" description="Noktaya sahada ne deniyorsa o adı verin; etikette ve raporda bu ad görünür." />
          <PatrolPointsAddForm projectId={id} />
        </Card>

        <Card>
          <CardHeader title="Proje PIN'i" description="Görevliler QR'ı okuttuktan sonra bu PIN'i girer. Değiştirince eskisi hemen geçersiz olur." />
          <div className="space-y-4 p-5">
            {pin ? (
              <p className="flex items-center gap-3">
                <KeyRound className="size-5 text-muted" aria-hidden />
                <span className="font-mono text-3xl font-semibold tracking-[0.35em] tabular-nums">{pin}</span>
              </p>
            ) : (
              <p className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm">PIN yok: bu projede okutma yapılamaz. Bir PIN oluşturup görevlilerle paylaşın.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <form action={generateProjectPin}>
                <input type="hidden" name="project_id" value={id} />
                {pin ? (
                  <ConfirmSubmit message="PIN değiştirilsin mi? Eski PIN hemen geçersiz olur; yeni PIN'i görevlilere bildirmeniz gerekir." className={btn("secondary", "sm")}>
                    PIN&apos;i değiştir
                  </ConfirmSubmit>
                ) : (
                  <button className={btn("primary", "sm")}>PIN oluştur</button>
                )}
              </form>
              {pin && (
                <form action={removeProjectPin}>
                  <input type="hidden" name="project_id" value={id} />
                  <ConfirmSubmit message="PIN kaldırılsın mı? PIN yokken bu projede okutma yapılamaz." className="text-sm text-danger hover:underline">
                    Kaldır
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`${points.length} nokta`}
          description="Adın yanındaki kalemle adı değiştirebilir, oklarla sırasını (etiket ve rapor sırası) değiştirebilirsiniz. Ad değişince QR aynı kalır."
        />
        {points.length === 0 ? (
          <EmptyState title="Bu projede henüz nokta yok" description="Yukarıdaki kutuya nokta adlarını yazıp ekleyin, ardından etiketlerini yazdırın." />
        ) : (
          <Table head={["Sıra", "Nokta", "Son okutma", "Konum", "Durum", ""]}>
            {points.map((p, i) => {
              const last = lastScan.get(p.id);
              return (
                <tr key={p.id} className={cn(!p.is_active && "opacity-60")}>
                  <td className={cn(td, "w-20 whitespace-nowrap")}>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="w-5 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                      <form action={movePatrolPoint}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="dir" value="up" />
                        <button disabled={i === 0} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg disabled:invisible" aria-label={`${p.name} — yukarı taşı`}>
                          <ArrowUp className="size-3.5" aria-hidden />
                        </button>
                      </form>
                      <form action={movePatrolPoint}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="dir" value="down" />
                        <button disabled={i === points.length - 1} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg disabled:invisible" aria-label={`${p.name} — aşağı taşı`}>
                          <ArrowDown className="size-3.5" aria-hidden />
                        </button>
                      </form>
                    </span>
                  </td>
                  <td className={td}>
                    <PatrolPointName id={p.id} name={p.name} />
                    <p className="font-mono text-xs text-muted" title="QR içeriği">{p.code}</p>
                  </td>
                  <td className={cn(td, "whitespace-nowrap tabular-nums", !last && "text-muted")}>{last ? fmtDateTime(last) : "Henüz okutulmadı"}</td>
                  <td className={cn(td, "whitespace-nowrap")}>
                    {p.lat != null && p.lng != null ? (
                      <>
                        <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className={linkBtn}>Haritada gör</a>
                        <form action={resetPatrolPointLocation} className="ml-3 inline" title="Konum silinir; noktadaki ilk isabetli okutmadan yeniden öğrenilir">
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmSubmit message={`“${p.name}” noktasının konumu sıfırlansın mı? Noktada yapılacak ilk isabetli okutmadan yeniden öğrenilir.`} className={mutedBtn}>
                            Sıfırla
                          </ConfirmSubmit>
                        </form>
                      </>
                    ) : (
                      <span className="text-sm text-muted" title="Noktadaki ilk isabetli okutmadan öğrenilir">İlk okutmada öğrenilecek</span>
                    )}
                  </td>
                  <td className={td}><Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Aktif" : "Pasif"}</Badge></td>
                  <td className={cn(td, "whitespace-nowrap text-right")}>
                    {p.is_active && (
                      <Link href={`/devriye/noktalar/yazdir?proje=${id}&nokta=${p.id}`} className={cn(linkBtn, "mr-3")}>Etiketi yazdır</Link>
                    )}
                    <form action={setPatrolPointActive} className="mr-3 inline">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={p.is_active ? "0" : "1"} />
                      <button className={mutedBtn}>{p.is_active ? "Pasife al" : "Aktifleştir"}</button>
                    </form>
                    <form action={removePatrolPoint} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmSubmit
                        message={`“${p.name}” silinsin mi? Okutma kaydı olan nokta silinmez, pasife alınır (raporlar bozulmasın diye).`}
                        label={`${p.name} — sil`}
                        className="inline-flex items-center gap-1 text-sm text-danger hover:underline"
                      >
                        <Trash2 className="size-3.5" aria-hidden /> Sil
                      </ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
