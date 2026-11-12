import type { MetadataRoute } from "next";
import { SITE_INDEXABLE, absoluteUrl } from "@/lib/site";
import { PUBLIC_PAGES } from "@/lib/seo";

/**
 * sitemap.xml — yalnızca herkese açık sayfalar. Arama motoru anahtarı kapalıyken (SITE_INDEXABLE) boş döner:
 * sayfalar noindex iken onları "dizine ekle" diye listelemek çelişkili olur.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_INDEXABLE) return [];
  return PUBLIC_PAGES.map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: p.updated,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
