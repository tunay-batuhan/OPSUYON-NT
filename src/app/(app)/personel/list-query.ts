import { str1 } from "@/lib/lookups";

type SP = Record<string, string | string[] | undefined>;

/** Personel listesinin filtreleri ve sayfası detaya taşınır; "geri" bağlantısı aynı listeye döner. */
export function personnelListQuery(sp: SP): string {
  const q = new URLSearchParams();
  for (const k of ["hat", "proje", "ad", "sayfa"]) {
    const v = str1(sp[k]);
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
