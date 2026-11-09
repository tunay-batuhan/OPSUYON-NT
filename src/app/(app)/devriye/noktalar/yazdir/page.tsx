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

/** QR etiketleri: yazdırılıp devriye noktalarına yapıştırılır (A4, 2 sütun). QR, sitedeki /d/<kod> sayfasını açar. */
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
  const labels = await Promise.all(points.map(async (p) => ({ ...p, svg: await QRCode.toString(patrolScanUrl(origin, p.code), { type: "svg", margin: 1, errorCorrectionLevel: "M" }) })));

  return (
    <>
      <style>{`@media print { aside, header, nav, .no-print { display: none !important } main { padding: 0 !important } .label { break-inside: avoid } }`}</style>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/devriye/noktalar/${projectId}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Projenin noktaları</Link>
        <PrintButton />
      </div>
      {local && (
        <p className="no-print mb-5 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Bu etiketler yerel adresi ({origin}) içeriyor; sahadaki telefonlar açamaz. Sahaya asılacak etiketleri yayındaki siteden yazdırın.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        {labels.map((l) => (
          <div key={l.id} className="label flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-400 bg-white p-5 text-center">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{l.projects?.organizations?.name ? `${l.projects.organizations.name} · ` : ""}{l.projects?.name}</p>
            <p className="text-xl font-bold leading-tight text-slate-900">{l.name}</p>
            {/* QR kodu kütüphanenin ürettiği SVG; içerik yalnızca sistemin ürettiği kod */}
            <div className="size-44" dangerouslySetInnerHTML={{ __html: l.svg }} aria-label={`${l.name} QR kodu`} role="img" />
            <p className="font-mono text-sm tracking-widest text-slate-700">{l.code}</p>
            <p className="text-[11px] text-slate-500">Telefon kamerasıyla okutun, PIN&apos;inizi girin</p>
          </div>
        ))}
      </div>
    </>
  );
}
