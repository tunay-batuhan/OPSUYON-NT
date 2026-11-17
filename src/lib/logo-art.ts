/**
 * OPSUYON logosunun TEK KAYNAĞI. Logo işareti (OPSUYON'un "O"su: halka, üç kişi, sarı ok) yalnızca burada tanımlıdır;
 * başka hiçbir yerde elle kopyalanmış logo çizimi bulunmamalı.
 *
 * Buradan türeyenler:
 *   - src/components/logo.tsx → <LogoMark>, <Logo> (uygulama, site, devriye etiketi yazdırma sayfası)
 *   - src/app/og-image.png/route.tsx → paylaşım görseli
 *   - scripts/brand-assets.mjs → public/brand/* (SVG + PNG), src/app/icon.svg, favicon.ico, apple-icon.png,
 *     public/icon-192.png, public/icon-512.png (üretilmiş dosyalar; elle düzenlenmez, betikle yeniden üretilir)
 *
 * Bu dosya bilerek hiçbir şey içe aktarmaz (betik Node ile doğrudan okuyabilsin).
 */

export const LOGO_VIEWBOX = 64;

export const LOGO_COLORS = { navy: "#0a2a63", blue: "#1f6fe5", sky: "#1e90f0", yellow: "#fbbf24" } as const;

/** Halka degradesi (sol üst açık mavi → lacivert), userSpaceOnUse */
export const LOGO_GRADIENT = {
  x1: 12, y1: 8, x2: 52, y2: 56,
  stops: [
    { offset: 0, color: LOGO_COLORS.sky },
    { offset: 0.5, color: LOGO_COLORS.blue },
    { offset: 1, color: LOGO_COLORS.navy },
  ],
} as const;

export const LOGO_RING = { cx: 32, cy: 31, r: 23, strokeWidth: 8 } as const;

/**
 * Halkanın içindeki ve önündeki şekiller, çizim sırasıyla (17 Kasım, yeni logo örneği): arkada iki kişi, önde ortada
 * büyük kişi (beyaz kontur ayırır), halkanın önünden sol alttan sağ üste çıkan sarı ok (gövde + dolu uç).
 */
export type LogoShape =
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number }
  | { kind: "path"; d: string; fill?: string; stroke?: string; strokeWidth?: number; cap?: "round"; join?: "round" };

const W = "#ffffff";
export const LOGO_SHAPES: readonly LogoShape[] = [
  { kind: "circle", cx: 22.6, cy: 26.6, r: 4.2, fill: LOGO_COLORS.navy },
  { kind: "circle", cx: 41.4, cy: 26.6, r: 4.2, fill: LOGO_COLORS.navy },
  { kind: "path", d: "M16.5 41c0-5 2.8-8.3 6.2-8.3s6.2 3.3 6.2 8.3v.6H16.5Z", fill: LOGO_COLORS.navy },
  { kind: "path", d: "M35.1 41c0-5 2.8-8.3 6.2-8.3s6.2 3.3 6.2 8.3v.6H35.1Z", fill: LOGO_COLORS.navy },
  { kind: "circle", cx: 32, cy: 22.6, r: 5.7, fill: LOGO_COLORS.navy, stroke: W, strokeWidth: 1.6 },
  { kind: "path", d: "M21.6 42.6c0-7.2 4.6-11.2 10.4-11.2s10.4 4 10.4 11.2v1H21.6Z", fill: LOGO_COLORS.navy, stroke: W, strokeWidth: 1.6, join: "round" },
  { kind: "path", d: "M5 45C14 55 35 52 52.2 32.4", stroke: LOGO_COLORS.yellow, strokeWidth: 4.6, cap: "round" },
  { kind: "path", d: "M56.1 27.9 55.9 35.6 48.6 29.2Z", fill: LOGO_COLORS.yellow, stroke: LOGO_COLORS.yellow, strokeWidth: 1.6, join: "round" },
];

/** Bir şeklin SVG öznitelikleri (dosya üretimi ve paylaşım görseli için). */
function shapeSvg(s: LogoShape): string {
  const paint = `fill="${s.kind === "path" ? (s.fill ?? "none") : s.fill}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}"` : ""}`;
  if (s.kind === "circle") return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${paint}/>`;
  return `<path d="${s.d}" ${paint}${s.cap ? ` stroke-linecap="${s.cap}"` : ""}${s.join ? ` stroke-linejoin="${s.join}"` : ""}/>`;
}

/**
 * İşaretin SVG içeriği (dış <svg> olmadan), dosya üretimi ve paylaşım görseli için.
 * `gradientId` aynı belgede birden fazla işaret varsa çakışmasın diye değiştirilebilir.
 */
export function logoMarkSvgInner(gradientId = "lm-ring"): string {
  const g = LOGO_GRADIENT;
  const stops = g.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("");
  const r = LOGO_RING;
  return [
    `<defs><linearGradient id="${gradientId}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>`,
    `<circle cx="${r.cx}" cy="${r.cy}" r="${r.r}" fill="none" stroke="url(#${gradientId})" stroke-width="${r.strokeWidth}"/>`,
    ...LOGO_SHAPES.map(shapeSvg),
  ].join("");
}

/**
 * Bağımsız SVG belgesi: yalnızca işaret. `disc`: arkasına beyaz daire (koyu zeminde görünsün diye; uygulamadaki
 * lacivert menüde olduğu gibi). `pad`: 64'lük çizim alanının çevresine eklenen boşluk (birim).
 */
export function logoMarkSvg({ size, disc = false, square = false, pad = 0 }: { size?: number; disc?: boolean; square?: boolean; pad?: number } = {}): string {
  const box = LOGO_VIEWBOX + pad * 2;
  const dim = size ? ` width="${size}" height="${size}"` : "";
  const c = LOGO_VIEWBOX / 2;
  const back = square
    ? `<rect x="${-pad}" y="${-pad}" width="${box}" height="${box}" fill="#ffffff"/>`
    : disc
      ? `<circle cx="${c}" cy="${c}" r="${c + pad}" fill="#ffffff"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${box} ${box}"${dim}>${back}${logoMarkSvgInner()}</svg>`;
}

/**
 * <Logo> ölçüleri (src/components/logo.tsx ile aynı): işaret kutusu, yazı boyutu, satır yüksekliği, işaret–yazı
 * boşluğu (px). Yazı: Geist, font-weight 800 (font-extrabold). Harf aralığı: `tracking-tight` (-0.025em) bağlantı
 * öğesinde (16px) hesaplanıp yazıya miras kaldığı için her boyutta -0.4px'tir (tarayıcıda ölçüldü).
 * Marka dosyaları (public/brand) "lg" ölçülerini kullanır.
 */
export const LOGO_SIZES = {
  sm: { mark: 32, font: 18, line: 28, gap: 2 },
  md: { mark: 40, font: 24, line: 32, gap: 4 },
  lg: { mark: 56, font: 36, line: 40, gap: 2 },
} as const;
export const WORDMARK_TRACKING_PX = -0.4;
export const WORDMARK_WEIGHT = 800;
