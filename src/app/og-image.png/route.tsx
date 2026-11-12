import { ImageResponse } from "next/og";
import { BRAND, BRAND_DOMAIN, BRAND_FOOTER, BRAND_TAGLINE } from "@/lib/brand";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Herkese açık sayfaların paylaşım görseli (WhatsApp, LinkedIn, X…): /og-image.png. Derleme anında bir kez üretilir.
 * Dosya kuralı (opengraph-image.tsx) yerine sabit adres: sayfalar kendi openGraph nesnesini verdiği için dosya kuralının
 * görseli alt sayfalarda düşüyordu (meta veriler sığ birleşir). Sayfalara src/lib/seo.ts → pageMetadata ekler.
 */
export const dynamic = "force-static";

const size = { width: 1200, height: 630 };
/**
 * Logo: public/brand/opsuyon-logo.svg (scripts/brand-assets.mjs ile tek kaynaktan — src/lib/logo-art.ts — üretilir;
 * yazı çizgiye çevrilmiş olduğundan yazı tipi gerekmez). Görsel derlemede bir kez üretilir.
 */
const LOGO_SVG = readFileSync(join(process.cwd(), "public/brand/opsuyon-logo.svg"));
const LOGO_SRC = `data:image/svg+xml;base64,${LOGO_SVG.toString("base64")}`;
const LOGO_RATIO = (() => {
  const m = LOGO_SVG.toString().match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return m ? Number(m[1]) / Number(m[2]) : 3.7;
})();
const LOGO_H = 104;

const lines = [
  { label: "Güvenlik", color: "#1f6fe5" },
  { label: "Temizlik", color: "#1fa255" },
  { label: "Danışma", color: "#7c3aed" },
  { label: "Tesis Yönetimi", color: "#b45309" },
];

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #f4f8fe 0%, #dce9fc 55%, #fdf3d6 100%)",
          color: "#0a2a63",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) yalnızca <img> anlar */}
          <img src={LOGO_SRC} width={Math.round(LOGO_H * LOGO_RATIO)} height={LOGO_H} alt={BRAND} />
          <div style={{ fontSize: 32, marginTop: 6, paddingLeft: 6, color: "#1f3c74" }}>{BRAND_TAGLINE}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>
            Personel operasyonlarınızın tüm süreçleri tek platformda
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
            {lines.map((l) => (
              <div key={l.label} style={{ display: "flex", background: l.color, color: "#fff", fontSize: 26, padding: "10px 22px", borderRadius: 999 }}>
                {l.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28 }}>
          <div style={{ display: "flex", fontStyle: "italic" }}>{BRAND_FOOTER}</div>
          <div style={{ display: "flex", background: "#fbbf24", color: "#3b2a00", padding: "8px 20px", borderRadius: 999, fontWeight: 700 }}>{BRAND_DOMAIN}</div>
        </div>
      </div>
    ),
    size,
  );
}
