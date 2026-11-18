/**
 * Yıllık ücretli izin hak edişi — 4857 sayılı İş Kanunu md. 53:
 *  - 1 yıldan az kıdem: hak yok (ilk yıl dolunca hak edilir)
 *  - 1–5 yıl (5 dahil): 14 gün
 *  - 5 yıldan fazla, 15 yıldan az: 20 gün
 *  - 15 yıl ve üzeri: 26 gün
 *  - 18 yaş ve altı ile 50 yaş ve üstü için en az 20 gün
 * Yalnızca hesap yardımcısı; sözleşmeyle daha yüksek süre verilmişse merkez bakiyeyi elle düzeltir.
 */
export function yearsBetween(from: string | Date, to: Date = new Date()): number {
  const a = new Date(from);
  let years = to.getFullYear() - a.getFullYear();
  const m = to.getMonth() - a.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < a.getDate())) years--;
  return Math.max(0, years);
}

export function ageOf(birthDate: string | null | undefined, at: Date = new Date()): number | null {
  return birthDate ? yearsBetween(birthDate, at) : null;
}

/** Çalışma süresi, "3 yıl 4 ay" biçiminde. */
export function tenureLabel(hireDate: string | null | undefined, at: Date = new Date()): string | null {
  if (!hireDate) return null;
  const h = new Date(hireDate);
  let months = (at.getFullYear() - h.getFullYear()) * 12 + (at.getMonth() - h.getMonth());
  if (at.getDate() < h.getDate()) months--;
  if (months < 0) return "henüz başlamadı";
  const y = Math.floor(months / 12), mo = months % 12;
  return [y ? `${y} yıl` : "", mo ? `${mo} ay` : ""].filter(Boolean).join(" ") || "1 aydan az";
}

export function legalAnnualLeaveDays(hireDate: string | null | undefined, birthDate: string | null | undefined, at: Date = new Date()): { days: number; reason: string } {
  if (!hireDate) return { days: 0, reason: "İşe giriş tarihi girilmedi" };
  const tenure = yearsBetween(hireDate, at);
  if (tenure < 1) return { days: 0, reason: "1 yıl dolmadan yıllık izin hak edilmez (İş K. md. 53)" };
  let days = tenure > 15 || tenure === 15 ? 26 : tenure > 5 ? 20 : 14;
  let reason = tenure >= 15 ? "15 yıl ve üzeri kıdem: 26 gün" : tenure > 5 ? "5–15 yıl kıdem: 20 gün" : "1–5 yıl kıdem: 14 gün";
  const age = ageOf(birthDate, at);
  if (age !== null && (age <= 18 || age >= 50) && days < 20) {
    days = 20;
    reason = `${age <= 18 ? "18 yaş ve altı" : "50 yaş ve üstü"}: en az 20 gün`;
  }
  return { days, reason };
}

/**
 * İşe girişten `at` tarihine kadar BİRİKEN yasal yıllık izin: her kıdem yıldönümünde o günkü kıdem ve yaşa göre hak
 * eklenir (İş K. md. 53; kullanılmayan yıllık izin yanmaz, sonraki yıla devreder). 2022'de işe giren biri 2026'da
 * 4 yıldönümü × 14 = 56 gün hak etmiştir.
 *  - total: toplam biriken hak
 *  - current: son yıldönümünde eklenen hak (bakiyenin "hak edilen" sütunu; legalAnnualLeaveDays ile aynı)
 *  - carried: önceki yıldönümlerinde biriken hak (bakiyenin "devreden" sütunu) = total − current
 * Personelin geçmişte kullandığı izin sistemde yoksa düşülmez; merkez bakiyeyi elle düzeltir.
 */
export function accruedAnnualLeave(
  hireDate: string | null | undefined, birthDate: string | null | undefined, at: Date = new Date(),
): { total: number; current: number; carried: number; years: number; detail: string } {
  if (!hireDate) return { total: 0, current: 0, carried: 0, years: 0, detail: "İşe giriş tarihi girilmedi" };
  const years = yearsBetween(hireDate, at);
  const hire = new Date(hireDate);
  const grants: number[] = [];
  for (let k = 1; k <= years && k <= 80; k++) {
    const anniversary = new Date(hire);
    anniversary.setFullYear(hire.getFullYear() + k);
    grants.push(legalAnnualLeaveDays(hireDate, birthDate, anniversary).days);
  }
  // içinde bulunulan yılın hakkı, diğer ekranlarla aynı: bugünkü kıdem ve yaşa göre (ör. son yıldönümünden sonra
  // 50 yaşını dolduran personel 20 gün alır)
  if (grants.length) grants[grants.length - 1] = legalAnnualLeaveDays(hireDate, birthDate, at).days;
  const total = grants.reduce((s, d) => s + d, 0);
  const current = grants.at(-1) ?? 0;
  // "4 yıl × 14 gün" ya da "5 yıl × 14 + 3 yıl × 20 gün"
  const groups: [number, number][] = [];
  for (const d of grants) {
    const last = groups.at(-1);
    if (last && last[1] === d) last[0]++;
    else groups.push([1, d]);
  }
  const detail = years < 1 ? "1 yıl dolmadan yıllık izin hak edilmez" : groups.map(([n, d]) => `${n} yıl × ${d}`).join(" + ") + " gün";
  return { total, current, carried: total - current, years, detail };
}

/**
 * İzin türleri. `deducts` = yıllık izin bakiyesinden düşer mi? (İş K. md. 55: Ek Madde 2'deki mazeret
 * izinleri ve raporlu/analık süreleri yıllık izinden düşülmez.) `legalDays` = kanundaki ücretli süre (bilgi amaçlı).
 */
export const LEAVE_TYPE_INFO: { code: string; label: string; deducts: boolean; legalDays?: number; note: string }[] = [
  { code: "yillik",        label: "Yıllık İzin",                 deducts: true,  note: "Yıllık izin bakiyesinden düşer" },
  { code: "ucretsiz",      label: "Ücretsiz İzin",               deducts: false, note: "Ücretsiz; bakiyeden düşmez" },
  { code: "raporlu",       label: "Raporlu (İstirahat)",         deducts: false, note: "Sağlık raporu; bakiyeden düşmez" },
  { code: "mazeret",       label: "Mazeret İzni",                deducts: false, note: "İşverenin verdiği mazeret izni" },
  { code: "evlilik",       label: "Evlilik İzni",                deducts: false, legalDays: 3,  note: "Yasal hak: 3 gün ücretli" },
  { code: "babalik",       label: "Babalık İzni",                deducts: false, legalDays: 5,  note: "Yasal hak: eşin doğum yapması hâlinde 5 gün ücretli" },
  { code: "dogum",         label: "Doğum (Analık) İzni",         deducts: false, legalDays: 112, note: "Yasal hak: doğum öncesi 8 + sonrası 8 hafta" },
  { code: "olum",          label: "Ölüm İzni",                   deducts: false, legalDays: 3,  note: "Yasal hak: eş, anne, baba, kardeş, çocuk vefatında 3 gün" },
  { code: "evlat_edinme",  label: "Evlat Edinme İzni",           deducts: false, legalDays: 3,  note: "Yasal hak: 3 gün ücretli" },
  { code: "engelli_cocuk", label: "Engelli Çocuk Tedavi İzni",   deducts: false, legalDays: 10, note: "Yasal hak: yılda toplam 10 gün (%70+ engelli / süreğen hastalık)" },
  { code: "diger",         label: "Diğer",                       deducts: false, note: "Bakiyeden düşmez" },
];
export const LEAVE_TYPE_CODES = LEAVE_TYPE_INFO.map((t) => t.code);
export const leaveDeducts = (code: string) => LEAVE_TYPE_INFO.find((t) => t.code === code)?.deducts ?? false;
