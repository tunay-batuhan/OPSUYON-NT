import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ChevronLeft, ClipboardList, Flag, KeyRound, Printer, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Table, btn, cn, td } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-dialog";
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

type Point = { id: string; name: string; code: string; kind: "nokta" | "tur"; is_active: boolean; lat: number | null; lng: number | null };

const linkBtn = "text-sm font-medium text-brand hover:underline";

/** Devriye turunun 3 adımı (proje ekranındaki "Nasıl çalışır"). */
const STEPS = [
  <><b>Başlat:</b> Görevli “Devriye başlat / bitir” QR&apos;ını okutur, proje PIN&apos;ini girer ve listeden adını seçer.</>,
  <><b>Noktalar:</b> Noktaların QR&apos;larını okutur; PIN ve ad sorulmaz, sıra serbesttir.</>,
  <><b>Bitir:</b> Başlat / bitir QR&apos;ını tekrar okutup “Devriyeyi bitir”e basar. Bitirilmezse son okutmadan 1 saat sonra kendiliğinden kapanır; raporda “Zaman aşımı” görünür.</>,
];
const mutedBtn = "text-sm text-muted hover:text-fg hover:underline";

/** Konum: "Haritada gör" + sıfırla, ya da ilk isabetli okutmada öğrenileceği bilgisi. */
function PointLocation({ p }: { p: Point }) {
  if (p.lat == null || p.lng == null) {
    return <span className="text-sm text-muted" title="Noktadaki ilk isabetli okutmadan öğrenilir">İlk okutmada öğrenilecek</span>;
  }
  return (
    <>
      <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className={linkBtn}>Haritada gör</a>
      <form action={resetPatrolPointLocation} className="ml-3 inline" title="Konum silinir; noktadaki ilk isabetli okutmadan yeniden öğrenilir">
        <input type="hidden" name="id" value={p.id} />
        <ConfirmSubmit tone="warning" title={`“${p.name}” noktasının konumu sıfırlansın mı?`} description="Konum silinir; noktada yapılacak ilk isabetli okutmadan yeniden öğrenilir." confirmLabel="Sıfırla" className={mutedBtn}>
          Sıfırla
        </ConfirmSubmit>
      </form>
    </>
  );
}

/**
 * Bir projenin devriye yönetimi tek ekranda: üstte "Devriye başlat / bitir" etiketi ve proje PIN'i, nokta ekleme
 * (her satır bir ad) ve kısa "Nasıl çalışır"; altta kontrol noktaları (adı satırda değiştirilir, sırası oklarla),
 * son okutma, konum, etiket, pasife alma ve silme. Başlat/bitir etiketi listede yer almaz, silinmez, taşınmaz.
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
    supabase.from("patrol_points").select("id, name, code, kind, is_active, lat, lng").eq("project_id", id).order("sort_order").order("name").order("id"),
    supabase.from("patrol_pins").select("pin").eq("project_id", id).maybeSingle(),
    supabase.from("patrol_scans").select("point_id, scanned_at").eq("project_id", id).gte("scanned_at", since).order("scanned_at", { ascending: false }).limit(5000),
  ]);
  const all = (pointRows ?? []) as Point[];
  // başlat/bitir etiketi (kind 'tur') ayrı kartta; liste, sayı ve sıra yalnızca kontrol noktaları
  const tour = all.find((p) => p.kind === "tur") ?? null;
  const points = all.filter((p) => p.kind === "nokta");
  const pin = (pinRow?.pin as string | undefined) ?? null;
  const lastScan = new Map<string, string>();
  for (const s of scans ?? []) if (!lastScan.has(s.point_id as string)) lastScan.set(s.point_id as string, s.scanned_at as string);
  const activeCount = points.filter((p) => p.is_active).length;
  const printCount = activeCount + (tour?.is_active ? 1 : 0);
  const tourLast = tour ? lastScan.get(tour.id) : undefined;

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
          {printCount > 0 && (
            <Link href={`/devriye/noktalar/yazdir?proje=${id}`} className={btn("primary", "sm")} title="Önce başlat / bitir etiketi, sonra aktif noktalar sırayla (A7, A4 yatay sayfada 8 etiket)">
              <Printer className="size-4" aria-hidden /> Tüm etiketleri yazdır ({printCount})
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Devriye başlat / bitir etiketi"
            description="Görevli devriyeye bu QR'ı okutup proje PIN'ini girerek ve adını seçerek başlar; bitirirken aynı QR'ı yeniden okutur. Etiketi devriyenin başladığı yere (ör. güvenlik kulübesi) asın."
            action={
              tour?.is_active ? (
                <Link href={`/devriye/noktalar/yazdir?proje=${id}&nokta=${tour.id}`} className={btn("secondary", "sm")}>
                  <Printer className="size-4" aria-hidden /> Etiketi yazdır
                </Link>
              ) : undefined
            }
          />
          {tour ? (
            <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">QR içeriği</dt>
                <dd className="mt-1 flex items-center gap-2 font-mono font-semibold tracking-wider">
                  <Flag className="size-4 text-brand" aria-hidden /> {tour.code}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Son okutma</dt>
                <dd className={cn("mt-1 tabular-nums", !tourLast && "text-muted")}>{tourLast ? fmtDateTime(tourLast) : "Henüz okutulmadı"}</dd>
              </div>
              <div>
                <dt className="text-muted">Konum</dt>
                <dd className="mt-1 whitespace-nowrap"><PointLocation p={tour} /></dd>
              </div>
              {!tour.is_active && (
                <div className="sm:col-span-3">
                  <dt className="sr-only">Durum</dt>
                  <dd><Badge tone="warning">Pasif: bu etiketle devriye başlatılamaz</Badge></dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="p-5 text-sm text-muted">Projeye ilk noktayı eklediğinizde bu etiket kendiliğinden oluşur.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Proje PIN'i" description="Yalnızca devriyeyi başlatırken (başlat / bitir QR'ında) sorulur; noktalarda PIN sorulmaz. Değiştirince eskisi hemen geçersiz olur." />
          <div className="space-y-4 p-5">
            {pin ? (
              <p className="flex items-center gap-3">
                <KeyRound className="size-5 text-muted" aria-hidden />
                <span className="font-mono text-3xl font-semibold tracking-[0.35em] tabular-nums">{pin}</span>
              </p>
            ) : (
              <p className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm">PIN yok: bu projede devriye başlatılamaz. Bir PIN oluşturup görevlilerle paylaşın.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <form action={generateProjectPin}>
                <input type="hidden" name="project_id" value={id} />
                {pin ? (
                  <ConfirmSubmit tone="warning" title="PIN değiştirilsin mi?" description="Eski PIN hemen geçersiz olur; yeni PIN'i görevlilere bildirmeniz gerekir." confirmLabel="PIN'i değiştir" className={btn("secondary", "sm")}>
                    PIN&apos;i değiştir
                  </ConfirmSubmit>
                ) : (
                  <button className={btn("primary", "sm")}>PIN oluştur</button>
                )}
              </form>
              {pin && (
                <form action={removeProjectPin}>
                  <input type="hidden" name="project_id" value={id} />
                  <ConfirmSubmit title="PIN kaldırılsın mı?" description="PIN yokken bu projede devriye başlatılamaz." confirmLabel="Kaldır" className="text-sm text-danger hover:underline">
                    Kaldır
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Nokta ekle" description="Noktaya sahada ne deniyorsa o adı verin; etikette ve raporda bu ad görünür." />
          <PatrolPointsAddForm projectId={id} />
        </Card>

        <Card>
          <CardHeader title="Nasıl çalışır" />
          <ol className="space-y-3 p-5 text-sm">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand" aria-hidden>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`${points.length} nokta`}
          description="Adın yanındaki kalemle adı değiştirebilir, oklarla sırasını (etiket numarası ve rapor sırası) değiştirebilirsiniz. Ad değişince QR aynı kalır. Sahada okutma sırası serbesttir."
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
                    <PointLocation p={p} />
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
                        title={`“${p.name}” silinsin mi?`}
                        description="Okutma kaydı olan nokta silinmez, pasife alınır (raporlar bozulmasın diye)."
                        label={`${p.name} — sil`}
                        icon={<Trash2 className="size-3.5" aria-hidden />}
                        className="inline-flex items-center gap-1 text-sm text-danger hover:underline"
                      >
                        Sil
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
