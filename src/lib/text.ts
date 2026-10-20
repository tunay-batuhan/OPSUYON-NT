/**
 * Arama için metni sadeleştirir: küçük harfe çevirir ve Türkçe karakterleri ASCII karşılıklarına indirir,
 * böylece "guvenlik" yazan biri "Güvenlik" kaydını da bulur.
 */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aranan her sözcük metnin içinde (herhangi bir yerde) geçiyorsa true. Boş arama her şeyi eşler. */
export function matches(haystack: string, query: string): boolean {
  const h = fold(haystack);
  return fold(query)
    .split(" ")
    .filter(Boolean)
    .every((w) => h.includes(w));
}
