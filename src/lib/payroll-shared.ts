// Bordro ve maaş: istemci ve sunucunun ortak tipleri ve küçük yardımcıları (tablo, PDF ve Excel aynı sütunları kullanır).
import { MONTHS } from "@/lib/format";
import type { Cells, PayCol } from "@/lib/payroll-engine";

/** Bir personelin satırı: girilen hücreler + hesaplanan değerler. */
export type PayrollLineView = {
  id: string;
  personnel_id: string;
  full_name: string;
  title: string | null;
  /** ücret tanımı var mı (yoksa tanim_… değişkenleri 0) */
  has_rates: boolean;
  /** girilen değerler ve elle ezilen formül hücreleri */
  cells: Cells;
  /** tüm sayısal sütunların sonucu (ham; gösterimde 2 ondalığa yuvarlanır) */
  values: Record<string, number>;
  texts: Record<string, string>;
  /** formülü elle ezilmiş sütun kodları */
  overridden: string[];
  /** canlı önizleme için: personelin ücret tanımı / avans değişkenleri */
  vars: Record<string, number>;
};

/** Bir dönemin ekran / dışa aktarım verisi. */
export type PayrollRunView = {
  id: string;
  project_id: string;
  org: string;
  project: string;
  year: number;
  month: number;
  status: "draft" | "approved";
  approvedAt: string | null;
  approvedBy: string | null;
  /** dönemin şablonu (başlatılırken kopyalanır) */
  columns: PayCol[];
  lines: PayrollLineView[];
  totals: Record<string, number>;
};

export const periodLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;

/** Türkçe sayı (2 ondalık): 28.075,50 */
export const tl = (n: number | null | undefined) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n ?? 0));

/** Gün / adet: 30 · 1,5 */
export const dayFmt = (n: number | null | undefined) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(Number(n ?? 0));

/** Sütun değeri gösterimi: bilgi grubundaki küçük sayılar (gün, adet) kısa; tutarlar 2 ondalık. */
export const cellFmt = (col: Pick<PayCol, "group" | "code">, n: number | null | undefined) =>
  col.group === "bilgi" && !/maas|ucret|tutar/.test(col.code) ? dayFmt(n) : tl(n);

/** Dosya adı için sade metin. */
export const fileSafe = (s: string) =>
  s
    .replaceAll("İ", "I").replaceAll("ı", "i").replaceAll("Ş", "S").replaceAll("ş", "s").replaceAll("Ğ", "G").replaceAll("ğ", "g")
    .replaceAll("Ü", "U").replaceAll("ü", "u").replaceAll("Ö", "O").replaceAll("ö", "o").replaceAll("Ç", "C").replaceAll("ç", "c")
    .replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "bordro";
