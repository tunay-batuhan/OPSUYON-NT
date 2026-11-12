// OPSÜYON logo dosyalarını TEK KAYNAKTAN (src/lib/logo-art.ts) üretir. Elle düzenlenen logo dosyası yoktur.
//
// Üretilenler:
//   public/brand/opsuyon-mark.svg|png         işaret ("O"), saydam (PNG 1024×1024)
//   public/brand/opsuyon-logo.svg|png         işaret + "PSÜYON" (lacivert yazı), saydam (PNG ~2000 px genişlik)
//   public/brand/opsuyon-logo-white.svg|png   koyu zemin için: beyaz yazı + işaretin arkasında beyaz daire
//   src/app/icon.svg                          sekme ikonu (işaret tuvali doldurur; kare zemin yok, halkanın içi beyaz)
//   src/app/favicon.ico                       16 + 32 + 48 px (PNG gömülü ICO)
//   src/app/apple-icon.png                    180×180, beyaz kare zemin
//   public/icon-192.png, public/icon-512.png  web manifest ikonları
//
// Yazı ("PSÜYON") SVG'lerde <text> değil, çizgiye (path) çevrilmiştir: Geist yazı tipi yüklü olmasa da aynı görünür.
// Ölçüler <Logo size="lg"> ile aynıdır (LOGO_SIZES.lg: işaret 56, yazı 36/40, boşluk 6, harf aralığı -0.4px).
//
// Çalıştırma (repo kökünden):
//   OPENTYPE_JS=<opentype.js/dist/opentype.module.js yolu> node scripts/brand-assets.mjs
// Gerekenler:
//   - opentype.js (yazıyı çizgiye çevirmek için). Projeye bağımlılık olarak EKLENMEDİ: geçici bir klasöre kurun
//     (npm i opentype.js@1.3.4 --prefix <geçici>) ve OPENTYPE_JS ile gösterin; ya da global/yerel olarak kuruluysa
//     doğrudan "opentype.js" adıyla bulunur.
//   - Geist ExtraBold (800) TTF: GEIST_TTF=<dosya> verilmezse Google Fonts'tan indirilir (geçici klasörde önbellek).
//   - sharp (PNG üretimi): Next.js ile zaten node_modules'ta bulunur.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { LOGO_RING, LOGO_SIZES, WORDMARK_TRACKING_PX, logoMarkSvg, logoMarkSvgInner, LOGO_COLORS } from "../src/lib/logo-art.ts";
import { BRAND_WORD } from "../src/lib/brand.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const out = (p) => path.join(ROOT, p);
const GENERATED = "<!-- Üretilmiş dosya: scripts/brand-assets.mjs (kaynak: src/lib/logo-art.ts). Elle düzenlemeyin. -->";

/* ---------------- yazı tipi ---------------- */
async function loadOpentype() {
  const spec = process.env.OPENTYPE_JS;
  const mod = await import(spec ? pathToFileURL(spec).href : "opentype.js");
  return mod.default ?? mod;
}
async function geistTtf() {
  if (process.env.GEIST_TTF) return fs.readFileSync(process.env.GEIST_TTF);
  const cache = path.join(os.tmpdir(), "opsuyon-geist-800.ttf");
  if (fs.existsSync(cache)) return fs.readFileSync(cache);
  const css = await (await fetch("https://fonts.googleapis.com/css2?family=Geist:wght@800", { headers: { "User-Agent": "Mozilla/4.0" } })).text();
  const url = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error("Geist TTF adresi bulunamadı");
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(cache, buf);
  return buf;
}

const opentype = await loadOpentype();
const ttf = await geistTtf();
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

/* ---------------- yerleşim (<Logo size="lg"> ile aynı) ---------------- */
const L = LOGO_SIZES.lg;
const upm = font.unitsPerEm;
const asc = font.tables.hhea.ascender / upm, desc = -font.tables.hhea.descender / upm;
// Tarayıcı satır kutusu: yarım satır aralığı + ascent → taban çizgisi (yazı kutusu işarete göre dikeyde ortalı).
// Chrome yükseklikleri tam piksele yuvarlar.
const lineTop = (L.mark - L.line) / 2;
const ascPx = Math.round(asc * L.font), descPx = Math.round(desc * L.font);
const baseline = lineTop + Math.floor((L.line - (ascPx + descPx)) / 2) + ascPx;
const textX = L.mark + L.gap;
const letterSpacingEm = WORDMARK_TRACKING_PX / L.font;
const glyphPath = font.getPath(BRAND_WORD, textX, baseline, L.font, { kerning: true, letterSpacing: letterSpacingEm });
const d = glyphPath.toPathData(3);
const advance = font.getAdvanceWidth(BRAND_WORD, L.font, { kerning: true, letterSpacing: letterSpacingEm });
const bbox = glyphPath.getBoundingBox();
// Genişlik: yazının ilerleme genişliği (son harften sonraki harf aralığı dahil, tarayıcıdaki kutu gibi), mürekkep taşarsa o
const width = Math.ceil(Math.max(textX + advance, bbox.x2) * 100) / 100;
const height = L.mark;
console.log(`yerleşim: yazı ${L.font}px, taban ${baseline}px, yazı x=${textX}, genişlik ${width}×${height}`);

/** İşaret, logo SVG'sinin içinde 56×56 kutuda (iç içe <svg>, 64'lük çizim alanı). */
const nestedMark = (disc) =>
  `<svg x="0" y="0" width="${L.mark}" height="${L.mark}" viewBox="0 0 64 64">${disc ? '<circle cx="32" cy="32" r="32" fill="#ffffff"/>' : ""}${logoMarkSvgInner()}</svg>`;
const logoSvg = ({ white = false } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 4}" height="${height * 4}">${GENERATED}` +
  `<title>OPSÜYON</title>${nestedMark(white)}<path d="${d}" fill="${white ? "#ffffff" : LOGO_COLORS.navy}"/></svg>`;

/* ---------------- yazma ---------------- */
const sizes = [];
function write(rel, data) {
  const p = out(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  sizes.push(`${rel}  ${(fs.statSync(p).size / 1024).toFixed(1)} KB`);
}
const withComment = (svg) => svg.replace(/^(<svg[^>]*>)/, `$1${GENERATED}`);
/** SVG → PNG: önce büyük çizip sonra küçültür (küçük boyutlarda daha iyi kenar yumuşatma). */
async function png(svg, w, h = w, { flatten = false } = {}) {
  const big = await sharp(Buffer.from(svg), { density: 1200 }).resize(w * 4, h * 4, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  let img = sharp(big).resize(w, h, { kernel: "lanczos3" });
  if (flatten) img = img.flatten({ background: "#ffffff" });
  return img.png({ compressionLevel: 9 }).toBuffer();
}

// marka dosyaları
const markSvg = withComment(logoMarkSvg({ size: 512 }));
write("public/brand/opsuyon-mark.svg", markSvg);
write("public/brand/opsuyon-mark.png", await png(markSvg, 1024));
const logoNavy = logoSvg();
const logoWhite = logoSvg({ white: true });
write("public/brand/opsuyon-logo.svg", logoNavy);
write("public/brand/opsuyon-logo-white.svg", logoWhite);
const pngW = 2000, pngH = Math.round((2000 * height) / width);
write("public/brand/opsuyon-logo.png", await png(logoNavy, pngW, pngH));
write("public/brand/opsuyon-logo-white.png", await png(logoWhite, pngW, pngH));

/* ---------------- site ikonları ----------------
 * İşaret tuvali doldurur: işaretin GERÇEK mürekkep kutusu (sola-aşağı taşan sarı ok ve çizgi kalınlıkları dahil)
 * ölçülür ve kutunun merkezine ortalanır (halkanın merkezine değil). Yalnızca ölçek + kırpma (viewBox); çizim aynıdır.
 * Sekme ikonu (Tunay, 12 Kasım): DAİRE — kare zemin yok, boşluk yok; mavi halka ikonun dış sınırıdır (üst ve sağ
 * kenara değer, sarı ok sol ve alt kenara). Halkanın içi beyazdır (koyu sekmede kişi figürü okunur), dışı saydam.
 * iOS ve "maskable" ikonlar platform gereği beyaz kare zeminlidir.
 */
const INK_SCALE = 10; // 64 birim → 640 px ölçüm görüntüsü
const inkProbe = await sharp(Buffer.from(logoMarkSvg({ size: 64 * INK_SCALE })), { density: 72 })
  .png().trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
const ink = {
  x: -inkProbe.info.trimOffsetLeft / INK_SCALE,
  y: -inkProbe.info.trimOffsetTop / INK_SCALE,
  w: inkProbe.info.width / INK_SCALE,
  h: inkProbe.info.height / INK_SCALE,
};
console.log(`işaretin mürekkep kutusu (64'lük çizimde): x ${ink.x}–${ink.x + ink.w}, y ${ink.y}–${ink.y + ink.h}`);
/**
 * `fill`: mürekkep kutusunun uzun kenarının ikon kenarına oranı. `square`: tam kenara kadar beyaz kare zemin
 * (yoksa zemin saydam, yalnızca halkanın içi beyaz).
 */
function iconSvg({ fill = 1, square = false } = {}) {
  const side = Math.max(ink.w, ink.h) / fill;
  const cx = ink.x + ink.w / 2, cy = ink.y + ink.h / 2;
  const x = +(cx - side / 2).toFixed(3), y = +(cy - side / 2).toFixed(3), s = +side.toFixed(3);
  const back = square
    ? `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#ffffff"/>`
    : `<circle cx="${LOGO_RING.cx}" cy="${LOGO_RING.cy}" r="${LOGO_RING.r}" fill="#ffffff"/>`; // halka çizgisinin altında biter
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${s} ${s}">${GENERATED}${back}${logoMarkSvgInner()}</svg>`;
}
const tabSvg = iconSvg();
write("src/app/icon.svg", tabSvg);
write("public/icon-192.png", await png(tabSvg, 192));
write("public/icon-512.png", await png(tabSvg, 512));
// maskable: platform kendi maskesini uygular → keskin kare, işaret %80 güvenli bölgede (mürekkep kutusunun köşegeni
// güvenli dairenin (çap = kenarın %80'i) içinde kalır)
write("public/icon-maskable-512.png", await png(iconSvg({ fill: (0.8 * Math.max(ink.w, ink.h)) / Math.hypot(ink.w, ink.h), square: true }), 512, 512, { flatten: true }));
// iOS köşeleri kendisi yuvarlar ve saydamlığı siyah gösterir → keskin, tam beyaz kare
write("src/app/apple-icon.png", await png(iconSvg({ fill: 0.9, square: true }), 180, 180, { flatten: true }));
const icoSizes = [16, 32, 48];
const icoImgs = await Promise.all(icoSizes.map((s) => png(tabSvg, s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(icoSizes.length, 4);
let offset = 6 + 16 * icoSizes.length;
const dir = icoSizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(icoImgs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += icoImgs[i].length;
  return e;
});
write("src/app/favicon.ico", Buffer.concat([header, ...dir, ...icoImgs]));

console.log("\nüretildi:\n  " + sizes.join("\n  "));
