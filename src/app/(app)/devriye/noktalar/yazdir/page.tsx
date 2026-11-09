import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { isUuid, str1 } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";
import { patrolScanUrl } from "@/lib/patrol";
import { BRAND, BRAND_TAGLINE, BRAND_WORD } from "@/lib/brand";
import { LogoMark } from "@/components/logo";
import { cn } from "@/components/ui";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Barkod Etiketleri" };

/** QR'ın açacağı adresin kökü: SITE_URL (önerilen, ör. https://portal.opsuyon.com) yoksa bu isteğin adresi. */
async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Nokta adı uzadıkça küçülen yazı boyutu (cqw = A4 genişliğinin yüzdesi; 80 karaktere kadar). */
function nameSize(name: string): string {
  const n = [...name].length;
  if (n <= 18) return "text-[8cqw] leading-[1.05]";
  if (n <= 34) return "text-[6.2cqw] leading-[1.1]";
  if (n <= 56) return "text-[4.8cqw] leading-[1.15]";
  return "text-[3.9cqw] leading-[1.2]";
}

/*
 * Yazdırma: her etiket tam bir A4 dikey sayfa. Etiket içi ölçüler cqw (konteyner genişliği) ile verildiği
 * için ekrandaki önizleme ile kâğıt birebir aynı oranda çıkar. Ekranda etiketler alt alta, bir etiket ekrana
 * sığacak kadar küçültülmüş (yüksekliğe göre; en fazla 130 mm genişlik) A4 oranlı kartlar.
 */
const PRINT_CSS = `
@page { size: A4 portrait; margin: 0 }
@media print {
  html, body { background: #fff !important }
  aside, header, nav, .no-print { display: none !important }
  .min-h-screen { display: block !important; min-height: 0 !important }
  main { padding: 0 !important }
  main > div { max-width: none !important; margin: 0 !important }
  .sheets { gap: 0 !important }
  .sheet { width: 210mm !important; height: 297mm !important; aspect-ratio: auto !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; overflow: hidden; break-inside: avoid }
  .sheet + .sheet { break-before: page }
}
.sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact }
/* Logo halkası gradyanı (#lm-ring) kenar çubuğunda tanımlı; yazdırmada o gizlenince çözülemiyor → düz lacivert */
.sheet svg circle[stroke^="url("] { stroke: #0a2a63 }
`;

/** QR etiketleri: her devriye noktası için tam sayfa (A4) etiket; sahada duvara/direğe asılır. QR, sitedeki /d/<kod> sayfasını açar. */
export default async function PatrolLabelsPage({ searchParams }: PageProps<"/devriye/noktalar/yazdir">) {
  await requireStaff("patrol.manage");
  await requireModule("devriye");
  const sp = await searchParams;
  const projectId = str1(sp.proje);
  const pointId = str1(sp.nokta);
  if (!isUuid(projectId)) notFound();

  const supabase = await createClient();
  let q = supabase.from("patrol_points").select("id, name, code, projects(name, organizations(name))").eq("project_id", projectId).eq("is_active", true).order("sort_order").order("name");
  if (isUuid(pointId)) q = q.eq("id", pointId);
  const { data } = await q;
  const points = (data ?? []) as unknown as { id: string; name: string; code: string; projects: { name: string; organizations: { name: string } | null } | null }[];
  if (points.length === 0) notFound();

  const origin = await siteOrigin();
  const local = /\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(origin);
  const host = origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  // margin: 3 → QR'ın etrafında 3 modüllük sessiz bölge (quiet zone) + çerçeve içi boşluk; okunabilirlik için şart
  const labels = await Promise.all(points.map(async (p) => ({ ...p, svg: await QRCode.toString(patrolScanUrl(origin, p.code), { type: "svg", margin: 3, errorCorrectionLevel: "M" }) })));

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/devriye/noktalar/${projectId}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Projenin noktaları</Link>
        <p className="text-sm text-muted">{labels.length === 1 ? "1 etiket · tek sayfa (A4 dikey)" : `${labels.length} etiket · her biri ayrı sayfa (A4 dikey)`} · ekranda küçültülmüş önizleme</p>
        <PrintButton />
      </div>
      {local && (
        <p className="no-print mb-5 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Bu etiketler yerel adresi ({origin}) içeriyor; sahadaki telefonlar açamaz. Sahaya asılacak etiketleri yayındaki siteden yazdırın.
        </p>
      )}

      <div className="sheets flex flex-col items-center gap-8">
        {labels.map((l) => (
          <article key={l.id} className="sheet @container flex w-full max-w-[min(130mm,calc((100vh_-_14rem)*0.707))] flex-col overflow-hidden rounded-xl bg-white text-slate-900 shadow-card ring-1 ring-border aspect-[210/297]" aria-label={`${l.name} etiketi`}>
            {/* Üst şerit: marka + etiket türü */}
            <div className="flex h-[11cqw] shrink-0 items-center justify-between bg-navy px-[6cqw] text-white">
              <div className="flex items-center font-extrabold tracking-tight">
                <span className="grid size-[7cqw] place-items-center rounded-full bg-white"><LogoMark className="size-[7cqw]" /></span>
                <span aria-hidden className="ml-[0.5cqw] text-[4.6cqw]">{BRAND_WORD}</span>
                <span className="sr-only">{BRAND}</span>
              </div>
              <p className="text-[2.3cqw] font-semibold uppercase tracking-[0.22em] text-white/85">Devriye Kontrol Noktası</p>
            </div>
            <div className="h-[0.9cqw] shrink-0 bg-brand" aria-hidden />

            {/* Gövde */}
            <div className="flex min-h-0 flex-1 flex-col items-center px-[8cqw] pt-[5cqw] text-center">
              <p className="text-[2.4cqw] font-semibold uppercase tracking-[0.16em] text-slate-500">{l.projects?.organizations?.name ?? " "}</p>
              <p className="mt-[1cqw] text-[3.3cqw] font-semibold text-slate-700 text-balance">{l.projects?.name}</p>
              <h2 className={cn("mt-[3.5cqw] w-full font-extrabold text-slate-900 text-balance [overflow-wrap:anywhere]", nameSize(l.name))}>{l.name}</h2>

              {/* QR + kod: kalan alanda dikey ortalı. QR beyaz zemin üstünde siyah; kütüphanenin ürettiği SVG, içerik yalnızca sistemin ürettiği kod */}
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-[3cqw]">
                <div className="w-[76cqw] rounded-[2cqw] border-[0.4cqw] border-slate-300 bg-white p-[2cqw]">
                  <div className="aspect-square w-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: l.svg }} aria-label={`${l.name} QR kodu`} role="img" />
                </div>
                <p className="mt-[3cqw] font-mono text-[4cqw] font-semibold tracking-widest text-slate-800">{l.code}</p>
              </div>
            </div>

            {/* Alt bilgi */}
            <div className="flex h-[6.5cqw] shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-[6cqw] text-[2.1cqw] text-slate-500">
              <span className="font-mono tracking-wide">{host}</span>
              <span className="flex items-center gap-[1cqw]"><LogoMark className="size-[3.4cqw]" /><span><span className="font-bold text-navy">{BRAND}</span> · {BRAND_TAGLINE}</span></span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
