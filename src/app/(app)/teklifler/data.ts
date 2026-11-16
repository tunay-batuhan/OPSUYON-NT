import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOfferStatus, type OfferStatus } from "@/lib/offer-calc";

/**
 * Teklif listesi ve raporu (ekran + PDF aynı süzgeçler). Okuma kullanıcının oturumuyla: RLS yalnızca
 * offers.read / offers.manage yetkili merkez hesaplarına satır döndürür.
 */
export type OfferFilters = {
  /** oluşturma tarihi aralığı (YYYY-AA-GG, Türkiye saati) */
  start?: string;
  end?: string;
  status?: OfferStatus;
  /** hazırlayan (profiles.id) */
  by?: string;
  /** müşteri / site adında arama */
  q?: string;
};

export type OfferRow = {
  id: string; offer_no: string; customer_name: string; contact_name: string | null; status: OfferStatus;
  total_people: number; monthly_base: number; monthly_vat: number; offer_total: number; monthly_profit: number; yearly_profit: number;
  valid_until: string | null; created_at: string; created_by: string | null; decided_at: string | null;
};

export type OfferLine = { id: string; service: string; people: number; monthly_total: number; sort_order: number };

export type OfferDetail = OfferRow & {
  phone: string | null; email: string | null; address: string | null; notes: string | null;
  vat_rate: number; fee_per_person: number; updated_at: string;
};

export type OfferSettings = { fee_per_person: number; vat_rate: number; validity_days: number; services: string[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const ROW_COLS =
  "id, offer_no, customer_name, contact_name, status, total_people, monthly_base, monthly_vat, offer_total, monthly_profit, yearly_profit, valid_until, created_at, created_by, decided_at";

const one = (v: string | string[] | null | undefined) => (typeof v === "string" && v !== "" ? v : undefined);

/** Adresteki süzgeçler: ?bas=&bit=&durum=&hazirlayan=&musteri= */
export function offerFiltersFrom(sp: Record<string, string | string[] | undefined> | URLSearchParams): OfferFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? one(sp.get(k)) : one(sp[k]));
  const start = get("bas");
  const end = get("bit");
  const status = get("durum");
  const by = get("hazirlayan");
  const q = get("musteri")?.replace(/[%_*,()]/g, "").trim().slice(0, 60);
  return {
    start: start && ISO.test(start) && !Number.isNaN(Date.parse(start)) ? start : undefined,
    end: end && ISO.test(end) && !Number.isNaN(Date.parse(end)) ? end : undefined,
    status: isOfferStatus(status) ? status : undefined,
    by: by && UUID.test(by) ? by : undefined,
    q: q || undefined,
  };
}

export const hasFilters = (f: OfferFilters) => Boolean(f.start || f.end || f.status || f.by || f.q);

/** Süzgeçleri adrese çevirir (rapor PDF bağlantısı). */
export function offerFilterQuery(f: OfferFilters): string {
  const q = new URLSearchParams();
  if (f.start) q.set("bas", f.start);
  if (f.end) q.set("bit", f.end);
  if (f.status) q.set("durum", f.status);
  if (f.by) q.set("hazirlayan", f.by);
  if (f.q) q.set("musteri", f.q);
  return q.toString();
}

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function applyFilters<Q>(query: Q, f: OfferFilters): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase sorgu oluşturucusunun genel türü
  let r = query as any;
  if (f.start) r = r.gte("created_at", `${f.start}T00:00:00+03:00`);
  if (f.end) r = r.lt("created_at", `${nextDay(f.end)}T00:00:00+03:00`);
  if (f.status) r = r.eq("status", f.status);
  if (f.by) r = r.eq("created_by", f.by);
  if (f.q) r = r.ilike("customer_name", `%${f.q}%`);
  return r as Q;
}

const toRow = (r: Record<string, unknown>): OfferRow =>
  ({
    ...r,
    total_people: Number(r.total_people),
    monthly_base: Number(r.monthly_base),
    monthly_vat: Number(r.monthly_vat),
    offer_total: Number(r.offer_total),
    monthly_profit: Number(r.monthly_profit),
    yearly_profit: Number(r.yearly_profit),
  }) as OfferRow;

export async function loadOffers(f: OfferFilters, range?: { from: number; to: number }): Promise<{ rows: OfferRow[]; total: number }> {
  const supabase = await createClient();
  let q = applyFilters(supabase.from("offers").select(ROW_COLS, { count: "exact" }), f)
    .order("created_at", { ascending: false })
    .order("offer_no", { ascending: false });
  q = range ? q.range(range.from, range.to) : q.limit(2000);
  const { data, count } = await q;
  return { rows: ((data ?? []) as Record<string, unknown>[]).map(toRow), total: count ?? 0 };
}

export type OfferSummary = {
  total: number; open: number; accepted: number; rejected: number;
  /** kabul oranı: kabul ÷ (kabul + red); karar verilmemişse null */
  acceptRate: number | null;
  /** kabul edilen tekliflerin aylık OPSÜYON tutarı toplamı */
  acceptedMonthly: number;
  /** tüm tekliflerin yıllık net kâr toplamı (müşteri için kâr potansiyeli) */
  yearlyPotential: number;
};

export async function loadOfferSummary(f: OfferFilters): Promise<OfferSummary> {
  const supabase = await createClient();
  const { data } = await applyFilters(supabase.from("offers").select("status, offer_total, yearly_profit"), f).limit(10000);
  const rows = (data ?? []) as { status: OfferStatus; offer_total: number; yearly_profit: number }[];
  const accepted = rows.filter((r) => r.status === "accepted");
  const rejected = rows.filter((r) => r.status === "rejected").length;
  return {
    total: rows.length,
    open: rows.filter((r) => r.status === "draft" || r.status === "sent").length,
    accepted: accepted.length,
    rejected,
    acceptRate: accepted.length + rejected ? accepted.length / (accepted.length + rejected) : null,
    acceptedMonthly: accepted.reduce((s, r) => s + Number(r.offer_total), 0),
    yearlyPotential: rows.reduce((s, r) => s + Number(r.yearly_profit), 0),
  };
}

/**
 * Teklifi hazırlayanların adları. Profiller tablosunu yalnızca "kullanıcıları görüntüle" yetkisi olan okuyabildiği
 * için, teklif okuma yetkisi doğrulanmış kullanıcıya adlar servis anahtarıyla (yalnızca ad) getirilir.
 */
export async function loadCreatorNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return new Map();
  const { data } = await createAdminClient().from("profiles").select("id, full_name").in("id", unique);
  return new Map(((data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
}

/** Hazırlayan süzgecinin seçenekleri: teklif hazırlamış hesaplar. */
export async function loadCreatorOptions(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("offers").select("created_by").not("created_by", "is", null).limit(5000);
  const names = await loadCreatorNames(((data ?? []) as { created_by: string }[]).map((r) => r.created_by));
  return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

export async function loadOffer(id: string): Promise<{ offer: OfferDetail; lines: OfferLine[]; creator: string | null } | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const [{ data: o }, { data: l }] = await Promise.all([
    supabase.from("offers").select(`${ROW_COLS}, phone, email, address, notes, vat_rate, fee_per_person, updated_at`).eq("id", id).maybeSingle(),
    supabase.from("offer_lines").select("id, service, people, monthly_total, sort_order").eq("offer_id", id).order("sort_order"),
  ]);
  if (!o) return null;
  const offer = { ...toRow(o as Record<string, unknown>), vat_rate: Number(o.vat_rate), fee_per_person: Number(o.fee_per_person) } as OfferDetail;
  const lines = ((l ?? []) as OfferLine[]).map((x) => ({ ...x, people: Number(x.people), monthly_total: Number(x.monthly_total) }));
  const creator = offer.created_by ? ((await loadCreatorNames([offer.created_by])).get(offer.created_by) ?? null) : null;
  return { offer, lines, creator };
}

export async function loadOfferSettings(): Promise<OfferSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("offer_settings").select("fee_per_person, vat_rate, validity_days, services").eq("id", true).maybeSingle();
  return {
    fee_per_person: Number(data?.fee_per_person ?? 7500),
    vat_rate: Number(data?.vat_rate ?? 20),
    validity_days: Number(data?.validity_days ?? 30),
    services: (data?.services as string[] | null)?.length ? (data!.services as string[]) : ["Güvenlik", "Temizlik", "Teknik Personel", "Bahçıvan"],
  };
}
