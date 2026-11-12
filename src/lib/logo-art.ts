/**
 * OPSÜYON logosunun TEK KAYNAĞI. Logo işareti (OPSÜYON'un "O"su: halka, kişi, sarı ok) yalnızca burada tanımlıdır;
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

export const LOGO_COLORS = { navy: "#0a2a63", blue: "#1f6fe5", yellow: "#fbbf24" } as const;

/** Halka degradesi (lacivert → mavi → lacivert), userSpaceOnUse */
export const LOGO_GRADIENT = {
  x1: 8, y1: 8, x2: 56, y2: 56,
  stops: [
    { offset: 0, color: LOGO_COLORS.navy },
    { offset: 0.55, color: LOGO_COLORS.blue },
    { offset: 1, color: LOGO_COLORS.navy },
  ],
} as const;

export const LOGO_RING = { cx: 33, cy: 31, r: 23, strokeWidth: 8 } as const;
export const LOGO_HEAD = { cx: 33, cy: 25, r: 6.5, fill: LOGO_COLORS.blue } as const;
export const LOGO_BODY = { d: "M21 43c0-7.4 5.4-11.5 12-11.5S45 35.6 45 43v1H21v-1Z", fill: LOGO_COLORS.navy } as const;
/** Sarı ok: gövde eğrisi + uç. Kalınlık 4.5, uçlar yuvarlak; ok ucunun köşesi de yuvarlak. */
export const LOGO_ARROW = {
  stroke: LOGO_COLORS.yellow,
  strokeWidth: 4.5,
  paths: [
    { d: "M5 40c3 12 13 19 26 19", round: false },
    { d: "M26 53.5 33 59l-9 1.5", round: true },
  ],
} as const;

/**
 * İşaretin SVG içeriği (dış <svg> olmadan), dosya üretimi ve paylaşım görseli için.
 * `gradientId` aynı belgede birden fazla işaret varsa çakışmasın diye değiştirilebilir.
 */
export function logoMarkSvgInner(gradientId = "lm-ring"): string {
  const g = LOGO_GRADIENT;
  const stops = g.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("");
  const r = LOGO_RING, h = LOGO_HEAD, b = LOGO_BODY, a = LOGO_ARROW;
  return [
    `<defs><linearGradient id="${gradientId}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>`,
    `<circle cx="${r.cx}" cy="${r.cy}" r="${r.r}" fill="none" stroke="url(#${gradientId})" stroke-width="${r.strokeWidth}"/>`,
    `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="${h.fill}"/>`,
    `<path d="${b.d}" fill="${b.fill}"/>`,
    ...a.paths.map(
      (p) => `<path d="${p.d}" fill="none" stroke="${a.stroke}" stroke-width="${a.strokeWidth}" stroke-linecap="round"${p.round ? ' stroke-linejoin="round"' : ""}/>`,
    ),
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
