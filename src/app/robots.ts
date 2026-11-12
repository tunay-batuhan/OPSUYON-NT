import type { MetadataRoute } from "next";
import { SITE_INDEXABLE, absoluteUrl } from "@/lib/site";
import { PRIVATE_PATHS } from "@/lib/seo";

/**
 * robots.txt — derleme anında üretilir (SITE_INDEXABLE değişince yeniden yayın gerekir).
 * Kapalı (varsayılan): her şey kapalı, site haritası yok. Açık: herkese açık sayfalar açık, giriş arkası kapalı.
 */
export default function robots(): MetadataRoute.Robots {
  if (!SITE_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
