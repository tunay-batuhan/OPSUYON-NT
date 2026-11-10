/** Sunucu tabanlı sayfalama: listeler 10'ar kayıt, `?sayfa=N` ile gezilir. */
export const PAGE_SIZE = 10;

export type Paging = { page: number; from: number; to: number; size: number };

/**
 * URL'deki `sayfa` parametresinden Supabase `.range(from, to)` aralığını üretir. Aynı ekranda ikinci bir liste
 * kendi parametresini (`param`, ör. "bsayfa") kullanır.
 */
export function pagingFrom(sp: Record<string, string | string[] | undefined>, size = PAGE_SIZE, param = "sayfa"): Paging {
  const v = sp[param];
  const raw = typeof v === "string" ? Number(v) : 1;
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const from = (page - 1) * size;
  return { page, from, to: from + size - 1, size };
}

export const pageCount = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));

/** Mevcut filtreleri koruyarak sayfa bağlantısı üretir. */
export function pageHref(path: string, sp: Record<string, string | string[] | undefined>, page: number, hash?: string, param = "sayfa"): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v !== "" && k !== param) q.set(k, v);
  if (page > 1) q.set(param, String(page));
  const s = q.toString();
  return (s ? `${path}?${s}` : path) + (hash ? `#${hash}` : "");
}
