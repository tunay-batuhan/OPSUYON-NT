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
import { BRAND, BRAND_WORD } from "@/lib/brand";
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

/** Nokta adı uzadıkça küçülen yazı (en fazla 2 satır; daha uzunu "…" ile kesilir). 80 karaktere kadar. */
function nameSize(name: string): string {
  const n = [...name].length;
  if (n <= 14) return "nm-1";
  if (n <= 26) return "nm-2";
  if (n <= 44) return "nm-3";
  return "nm-4";
}

/** Bir A4 yatay sayfaya sığan etiket sayısı: 4 sütun × 2 satır. */
const COLS = 4;
const PER_SHEET = 8;

/*
 * Etiket A7 dikey (74 × 105 mm). A4 yatay sayfa (297 × 210 mm) → 4 × 74 = 296 mm, 2 × 105 = 210 mm: sayfada 8 etiket,
 * yanlarda 0,5'er mm boşluk. (A4 dikeyde yalnızca 2 × 2 = 4 etiket sığardı.) Etiketler arasında kesik kesim çizgisi.
 *
 * Etiket içi ölçüler --u ile verilir: --u = etiket genişliğinin 1/74'ü, yani kâğıtta tam 1 mm. Ekrandaki önizleme
 * aynı oranda küçülür; yazdırmada etiket 74 × 105 mm'dir. İçerik kenarlardan ≥ 4,5 mm içeride durur (yazıcının
 * basamadığı kenar payı için).
 */
const PRINT_CSS = `
@page { size: A4 landscape; margin: 0 }
.sheet { width: 100%; max-width: 297mm; aspect-ratio: 297 / 210; display: grid; grid-template-columns: repeat(${COLS}, calc(100% * 74 / 297)); grid-auto-rows: auto; justify-content: center; align-content: start; overflow: hidden; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact }
.lbl { position: relative; aspect-ratio: 74 / 105; overflow: hidden; container-type: inline-size; break-inside: avoid; page-break-inside: avoid; background: #fff; color: #0f172a }
.lbl.cut-r::after, .lbl.cut-b::before { content: ""; position: absolute; pointer-events: none }
.lbl.cut-r::after { top: 0; bottom: 0; right: 0; border-right: 1px dashed #94a3b8 }
.lbl.cut-b::before { left: 0; right: 0; bottom: 0; border-bottom: 1px dashed #94a3b8 }
.lbl-in { --u: calc(100cqw / 74); position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 calc(var(--u) * 5) calc(var(--u) * 5) }

/* Başlık bandı: tüm etiketlerde aynı (ortada logo, altında etiket türü) */
.lbl-band { display: flex; flex-direction: column; align-items: center; justify-content: center; width: calc(100% + var(--u) * 10); height: calc(var(--u) * 19); margin: 0 calc(var(--u) * -5); padding-top: calc(var(--u) * 1.5); background: #0a2a63; color: #fff; border-bottom: calc(var(--u) * 1) solid #1f6fe5; flex-shrink: 0 }
.logo { display: flex; align-items: center; justify-content: center; font-weight: 800; letter-spacing: -0.02em; line-height: 1 }
.logo-mark { display: grid; place-items: center; width: calc(var(--u) * 7); height: calc(var(--u) * 7); border-radius: 9999px; background: #fff }
.logo-mark svg { width: 100%; height: 100% }
.logo-word { margin-left: calc(var(--u) * 0.4); font-size: calc(var(--u) * 4.6); color: #fff }
.lbl-kind { margin-top: calc(var(--u) * 1.6); padding-left: 0.22em; font-size: calc(var(--u) * 2.5); font-weight: 700; letter-spacing: 0.22em; line-height: 1; text-transform: uppercase; opacity: 0.9 }

.lbl-proj { width: 100%; margin-top: calc(var(--u) * 2.4); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: calc(var(--u) * 2.6); font-weight: 600; line-height: 1.2; color: #475569 }
.lbl-name { display: flex; width: 100%; height: calc(var(--u) * 13); margin-top: calc(var(--u) * 0.6); align-items: center; justify-content: center }
.lbl-name > span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-weight: 800; overflow-wrap: anywhere; text-wrap: balance }
.nm-1 { font-size: calc(var(--u) * 6); line-height: 1.08 }
.nm-2 { font-size: calc(var(--u) * 4.8); line-height: 1.1 }
.nm-3 { font-size: calc(var(--u) * 3.9); line-height: 1.12 }
.nm-4 { font-size: calc(var(--u) * 3.1); line-height: 1.15 }
.tour .lbl-name > span { color: #1f6fe5; letter-spacing: 0.01em }
.lbl-qr { width: calc(var(--u) * 54); height: calc(var(--u) * 54); margin-top: calc(var(--u) * 0.6); flex-shrink: 0 }
.lbl-qr svg { display: block; width: 100%; height: 100% }
.lbl-foot { display: flex; width: 100%; flex: 1; align-items: center; justify-content: center; font-size: calc(var(--u) * 2.5); font-weight: 600; line-height: 1.2; color: #334155; text-wrap: balance }

@media print {
  html, body { background: #fff !important }
  aside, header, nav, .no-print { display: none !important }
  .min-h-screen { display: block !important; min-height: 0 !important }
  main { padding: 0 !important }
  main > div { max-width: none !important; margin: 0 !important }
  .sheets { display: block !important; gap: 0 !important }
  /* 209,9 mm: yuvarlama farkı yüzünden sona boş sayfa eklenmesin (alt 0,1 mm kâğıt kenarı) */
  .sheet { width: 297mm !important; height: 209.9mm !important; max-width: none !important; aspect-ratio: auto !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; break-inside: avoid; page-break-inside: avoid }
  .sheet + .sheet { break-before: page; page-break-before: always }
  .lbl { width: 74mm; height: 105mm; aspect-ratio: auto }
}
/* Logo halkası gradyanı (#lm-ring) kenar çubuğunda tanımlı; yazdırmada o gizlenince çözülemiyor → düz lacivert */
.sheet svg circle[stroke^="url("] { stroke: #0a2a63 }
`;

type Row = { id: string; name: string; code: string; kind: "nokta" | "tur"; is_active: boolean; projects: { name: string } | null };
type Label = Row & { no: number | null; svg: string };

/** Etiket başlığındaki logo (lacivert bantta beyaz). Satır içi SVG'dir; her yazıcıda keskin çıkar. */
function LabelLogo() {
  return (
    <div className="logo">
      <span className="logo-mark"><LogoMark /></span>
      <span aria-hidden className="logo-word">{BRAND_WORD}</span>
      <span className="sr-only">{BRAND}</span>
    </div>
  );
}

function QrBox({ l }: { l: Label }) {
  // kütüphanenin ürettiği SVG; içerik yalnızca sistemin ürettiği kod
  return <div className="lbl-qr" dangerouslySetInnerHTML={{ __html: l.svg }} aria-label={`${l.name} QR kodu`} role="img" />;
}

/**
 * Tüm etiketler aynı, ortalanmış düzendedir: lacivert başlık (logo + tür) · proje · ad · QR · alt satır.
 * Başlat / bitir etiketi yalnızca yazılarıyla ayrışır (mavi "BAŞLAT / BİTİR" ve "başlarken ve bitirirken okutun").
 * QR'ın altına kod yazılmaz: etiketi nokta adı tanıtır.
 */
function LabelCard({ l, index }: { l: Label; index: number }) {
  const col = index % COLS;
  const row = Math.floor((index % PER_SHEET) / COLS);
  const cut = cn(col < COLS - 1 && "cut-r", row === 0 && "cut-b");
  const tour = l.kind === "tur";
  const title = tour ? "BAŞLAT / BİTİR" : l.name;
  return (
    <article className={cn("lbl", tour && "tour", cut)} aria-label={tour ? "Devriye başlat / bitir etiketi" : `${l.name} etiketi`}>
      <div className="lbl-in">
        <div className="lbl-band">
          <LabelLogo />
          <p className="lbl-kind">{tour ? "Devriye turu" : "Devriye noktası"}</p>
        </div>
        <p className="lbl-proj">{l.projects?.name}</p>
        <h2 className="lbl-name"><span className={nameSize(title)}>{title}</span></h2>
        <QrBox l={l} />
        <p className="lbl-foot">{tour ? "Devriyeye başlarken ve bitirirken okutun" : l.no != null ? `Nokta ${l.no}` : "Devriye noktası"}</p>
      </div>
    </article>
  );
}

/**
 * QR etiketleri (A7, A4 yatay sayfada 8 tane). Tüm etiketler: önce projenin "Devriye başlat / bitir" etiketi, sonra
 * aktif noktalar sırayla. `?nokta=<id>` ile tek etiket sayfanın sol üstüne basılır. QR, sitedeki /d/<kod> sayfasını açar.
 */
export default async function PatrolLabelsPage({ searchParams }: PageProps<"/devriye/noktalar/yazdir">) {
  await requireStaff("patrol.manage");
  await requireModule("devriye");
  const sp = await searchParams;
  const projectId = str1(sp.proje);
  const pointId = str1(sp.nokta);
  if (!isUuid(projectId)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("patrol_points")
    .select("id, name, code, kind, is_active, projects(name)")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("name")
    .order("id");
  const rows = (data ?? []) as unknown as Row[];
  // etiketteki sıra numarası, yönetim ekranındaki "Sıra" ile aynı (pasif noktalar da sayılır)
  const noOf = new Map(rows.filter((r) => r.kind === "nokta").map((r, i) => [r.id, i + 1]));
  const tour = rows.filter((r) => r.kind === "tur" && r.is_active);
  const checkpoints = rows.filter((r) => r.kind === "nokta" && r.is_active);
  let points = [...tour, ...checkpoints];
  if (isUuid(pointId)) points = points.filter((p) => p.id === pointId);
  if (points.length === 0) notFound();

  const origin = await siteOrigin();
  const local = /\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(origin);
  // QR kutusu 54 mm: içinde 3 modüllük sessiz bölge (quiet zone), çevresindeki beyaz etiket alanıyla en az 4 modül.
  // Q düzeyi (%25 onarım): kirlenen/çizilen etikette de okunur
  const labels: Label[] = await Promise.all(
    points.map(async (p) => ({
      ...p,
      no: noOf.get(p.id) ?? null,
      svg: await QRCode.toString(patrolScanUrl(origin, p.code), { type: "svg", margin: 3, errorCorrectionLevel: "Q" }),
    })),
  );
  const sheets: Label[][] = [];
  for (let i = 0; i < labels.length; i += PER_SHEET) sheets.push(labels.slice(i, i + PER_SHEET));

  const summary =
    labels.length === 1
      ? "1 etiket · A7 (74 × 105 mm) · sayfanın sol üstüne basılır"
      : `${labels.length} etiket · A7 (74 × 105 mm) · A4 yatay sayfada 8 etiket · ${sheets.length} sayfa`;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/devriye/noktalar/${projectId}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Projenin noktaları</Link>
        <div className="text-sm text-muted">
          <p>{summary}</p>
          <p>Yazdırırken ölçek %100 ve kenar boşluğu “Yok” seçin; kesik çizgilerden kesin.</p>
        </div>
        <PrintButton />
      </div>
      {local && (
        <p className="no-print mb-5 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Bu etiketler yerel adresi ({origin}) içeriyor; sahadaki telefonlar açamaz. Sahaya asılacak etiketleri yayındaki siteden yazdırın.
        </p>
      )}

      <div className="sheets flex flex-col items-center gap-8">
        {sheets.map((sheet, s) => (
          <div key={s} className="sheet rounded-lg shadow-card ring-1 ring-border" aria-label={`Sayfa ${s + 1}`}>
            {sheet.map((l, i) => (
              <LabelCard key={l.id} l={l} index={i} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
