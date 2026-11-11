"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode } from "@/lib/patrol";

/**
 * Devriye TURU — herkese açık okutma sayfasının (/d/<kod>) sunucu işlemleri. Görevli giriş yapmaz.
 *   Başlat/bitir QR'ı → proje PIN'i + ad → tur başlar; telefona rastgele bir anahtar çerez olarak yazılır
 *   (veritabanında yalnızca SHA-256 özeti durur). Sonraki nokta QR'larında PIN/ad sorulmaz: anahtar açık turu bulur.
 *   Bitirme de aynı anahtarla yapılır. Kurallar veritabanındadır (patrol_tour_*).
 *
 *   Anahtar çerezde ve telefonun yerel hafızasında tutulur (sayfa her istekte açıkça gönderir, yoksa çereze bakılır).
 *   Bazı telefonların kamera / QR uygulaması her kodu hafızasız ayrı bir pencerede açar ve anahtar gelmez: o zaman
 *   veritabanı projedeki TEK açık turu kullanır; birden fazla açık tur varsa görevli PIN + adıyla kendi turunu seçer.
 */
const COOKIE = "opsuyon_devriye";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 saat: tur zaten son okutmadan 1 saat sonra kapanır

export type ScanLocation = { lat: number; lng: number; accuracy: number | null } | null;
export type TourInfo = { person: string; startedAt: string; endedAt: string | null; done: number; missing: string[] };
export type TourResult =
  | { ok: false; error: string }
  /** başlat/bitir QR'ı, açık tur yok → PIN + ad sorulur */
  | { ok: true; state: "start"; point: string; project: string; openTours: number }
  /** nokta QR'ı ama tur bulunamadı (açık tur yok ya da birden fazla) → kayıt yapılmadı */
  | { ok: true; state: "no_tour"; point: string; project: string; openTours: number }
  /** başlat/bitir QR'ı, tur açık → durum (tur kapanmaz). mine: bu telefonun anahtarıyla bulundu */
  | { ok: true; state: "active"; point: string; project: string; tour: TourInfo; tourId: string; mine: boolean; token?: string }
  | { ok: true; state: "started" | "ended"; point: string; project: string; tour: TourInfo; scannedAt: string; token?: string }
  | { ok: true; state: "scanned"; point: string; project: string; tour: TourInfo; scannedAt: string; duplicate: boolean; repeat: boolean; token?: string };

const cleanCode = (raw: unknown) => normalizeCode(String(raw ?? "")).slice(0, 40);
const validCode = (code: string) => /^[A-Z0-9-]{6,32}$/.test(code);
const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");
const CONNECTION = "Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.";

function locArgs(loc: ScanLocation) {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const lat = num(loc?.lat);
  const lng = num(loc?.lng);
  const has = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return { p_lat: has ? lat : null, p_lng: has ? lng : null, p_accuracy: has ? num(loc?.accuracy) : null };
}

type Raw = {
  ok: boolean; error?: string; state?: string; point?: string; project?: string; scanned_at?: string; duplicate?: boolean; repeat?: boolean;
  open_tours?: number; tour_id?: string; mine?: boolean;
  tour?: { person: string; started_at: string; ended_at: string | null; done: number; missing: string[] };
};

function shape(data: unknown): TourResult {
  const r = (data ?? {}) as Raw;
  if (!r.ok) return { ok: false, error: r.error ?? "İşlem yapılamadı. Tekrar deneyin." };
  const base = { ok: true as const, point: r.point ?? "", project: r.project ?? "" };
  const tour: TourInfo | null = r.tour
    ? { person: r.tour.person, startedAt: r.tour.started_at, endedAt: r.tour.ended_at, done: Number(r.tour.done ?? 0), missing: r.tour.missing ?? [] }
    : null;
  switch (r.state) {
    case "start":
    case "no_tour":
      return { ...base, state: r.state, openTours: Number(r.open_tours ?? 0) };
    case "active":
      return tour && r.tour_id
        ? { ...base, state: "active", tour, tourId: r.tour_id, mine: Boolean(r.mine) }
        : { ok: false, error: "Tur bilgisi okunamadı." };
    case "started":
    case "ended":
      return tour ? { ...base, state: r.state, tour, scannedAt: r.scanned_at ?? new Date().toISOString() } : { ok: false, error: "Tur bilgisi okunamadı." };
    case "scanned":
      return tour
        ? { ...base, state: "scanned", tour, scannedAt: r.scanned_at ?? new Date().toISOString(), duplicate: Boolean(r.duplicate), repeat: Boolean(r.repeat) }
        : { ok: false, error: "Tur bilgisi okunamadı." };
    default:
      return { ok: false, error: "Beklenmeyen yanıt. Tekrar deneyin." };
  }
}

const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(t);

/** Sayfanın gönderdiği anahtar (varsa) yoksa çerezdeki: SHA-256 özeti. */
async function readHash(sent?: string | null): Promise<string> {
  if (validToken(sent)) return hashOf(sent);
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  return validToken(token) ? hashOf(token) : "";
}

async function bindPhone(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Her QR okutmasında ilk çağrı. Nokta QR'ı + bulunan tur (anahtar ya da projedeki tek açık tur) → okutma kaydedilir.
 * Başlat/bitir QR'ı → tur bulunursa durumu, bulunmazsa "start" döner. Tur bulunmazsa nokta → "no_tour" (kayıt yok).
 */
export async function tourScan(rawCode: string, loc: ScanLocation, token?: string | null): Promise<TourResult> {
  const code = cleanCode(rawCode);
  if (!validCode(code)) return { ok: false, error: "Bu QR kodu tanınmadı." };
  const { data, error } = await createAdminClient().rpc("patrol_tour_scan", { p_code: code, p_token_hash: await readHash(token), ...locArgs(loc) });
  if (error) return { ok: false, error: CONNECTION };
  return shape(data);
}

const validPerson = (id: unknown) => /^[0-9a-f-]{36}$/i.test(String(id ?? "")); // uuid biçimi
const validPin = (pin: string) => /^[0-9]{4}$/.test(pin);

/**
 * Turu başlatır (yalnızca başlat/bitir QR'ında): PIN + seçilen ad. Telefon bu tura bağlanır. Kişinin açık turu
 * varsa yenisi açılmaz, o tur bu telefona bağlanır ve "active" döner.
 */
export async function tourStart(rawCode: string, rawPin: string, personnelId: string, loc: ScanLocation): Promise<TourResult> {
  const code = cleanCode(rawCode);
  const pin = String(rawPin ?? "").trim();
  if (!validCode(code)) return { ok: false, error: "Bu QR kodu tanınmadı." };
  if (!validPin(pin)) return { ok: false, error: "PIN 4 haneli olmalı." };
  if (!validPerson(personnelId)) return { ok: false, error: "Listeden adınızı seçin." };
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await createAdminClient().rpc("patrol_tour_start", {
    p_code: code, p_pin: pin, p_personnel_id: personnelId, p_token_hash: hashOf(token), ...locArgs(loc),
  });
  if (error) return { ok: false, error: CONNECTION };
  const res = shape(data);
  if (!res.ok) return res;
  await bindPhone(token);
  return res.state === "started" || res.state === "active" ? { ...res, token } : res;
}

/**
 * Turu bitirir (başlat/bitir QR'ında, görevli "Devriyeyi bitir"e basınca). Atlanan noktalar döner.
 * tourId: ekranda gösterilen tur; anahtar yoksa yalnızca bu tur (projedeki tek açık tursa) bitirilir.
 */
export async function tourEnd(rawCode: string, tourId: string, loc: ScanLocation, token?: string | null): Promise<TourResult> {
  const code = cleanCode(rawCode);
  if (!validCode(code)) return { ok: false, error: "Bu QR kodu tanınmadı." };
  const { data, error } = await createAdminClient().rpc("patrol_tour_end", {
    p_code: code, p_token_hash: await readHash(token), p_tour_id: validPerson(tourId) ? tourId : null, ...locArgs(loc),
  });
  if (error) return { ok: false, error: CONNECTION };
  const res = shape(data);
  if (res.ok) {
    const jar = await cookies();
    jar.delete({ name: COOKIE, path: "/" });
    jar.delete({ name: COOKIE, path: "/d" }); // eski sürümün çerezi
  }
  return res;
}

/**
 * Telefon turu tanımadıysa (çerez silinmiş, QR başka tarayıcıda açılmış): PIN + ad ile kişinin AÇIK turu bu
 * telefona bağlanır ve okutma işlenir. Açık turu yoksa kayıt yapılmaz.
 */
export async function tourResume(rawCode: string, rawPin: string, personnelId: string, loc: ScanLocation): Promise<TourResult> {
  const code = cleanCode(rawCode);
  const pin = String(rawPin ?? "").trim();
  if (!validCode(code)) return { ok: false, error: "Bu QR kodu tanınmadı." };
  if (!validPin(pin)) return { ok: false, error: "PIN 4 haneli olmalı." };
  if (!validPerson(personnelId)) return { ok: false, error: "Listeden adınızı seçin." };
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await createAdminClient().rpc("patrol_tour_resume", {
    p_code: code, p_pin: pin, p_personnel_id: personnelId, p_token_hash: hashOf(token), ...locArgs(loc),
  });
  if (error) return { ok: false, error: CONNECTION };
  const res = shape(data);
  if (!res.ok) return res;
  await bindPhone(token);
  // sayfa anahtarı saklar: sonraki okutmalarda PIN / ad sorulmaz
  return { ...res, token } as TourResult;
}
