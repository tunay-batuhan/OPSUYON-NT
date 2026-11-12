import type { MetadataRoute } from "next";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND} — ${BRAND_TAGLINE}`,
    short_name: BRAND,
    description: "Güvenlik, temizlik, danışma ve tesis yönetimi personel operasyonlarını tek panelde yönetin.",
    lang: "tr",
    dir: "ltr",
    start_url: "/",
    display: "standalone",
    background_color: "#eaf0f8",
    theme_color: "#0a2a63",
    icons: [
      // scripts/brand-assets.mjs ile tek kaynaktan (src/lib/logo-art.ts) üretilir
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
