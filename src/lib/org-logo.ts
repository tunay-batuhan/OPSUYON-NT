import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Firma logosu: PNG/JPG, en fazla 500 KB; 'documents' kovasında organizations/logo/ altında. */
export const ORG_LOGO_MAX = 500 * 1024;
export const ORG_LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg" } as const;
export type OrgLogoMime = keyof typeof ORG_LOGO_TYPES;

export type OrgLogo = { bytes: Uint8Array; mime: OrgLogoMime };

/** Personele basılan formların başlığındaki firma bilgileri. */
export type OrgBranding = {
  name: string;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_office: string | null;
  tax_no: string | null;
  logo: OrgLogo | null;
};

/** Dosyanın ilk baytlarından gerçek türü (uzantıya/beyana güvenmeden). */
export function sniffLogo(bytes: Uint8Array): OrgLogoMime | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

export async function downloadOrgLogo(path: string | null | undefined): Promise<OrgLogo | null> {
  if (!path) return null;
  try {
    const { data } = await createAdminClient().storage.from("documents").download(path);
    if (!data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mime = sniffLogo(bytes);
    return mime ? { bytes, mime } : null;
  } catch {
    return null;
  }
}

/**
 * Firmanın form başlığı bilgileri ve logosu (servis anahtarıyla; çağıran yetkiyi önceden doğrulamış olmalı).
 * Firma yoksa ya da logo sütunu henüz yoksa (migration uygulanmadıysa) logo boş döner.
 */
export async function loadOrgBranding(orgId: string | null | undefined): Promise<OrgBranding | null> {
  if (!orgId) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("name, legal_name, address, phone, email, tax_office, tax_no").eq("id", orgId).maybeSingle();
  if (!data) return null;
  const { data: l } = await admin.from("organizations").select("logo_path").eq("id", orgId).maybeSingle();
  const logo = await downloadOrgLogo((l as { logo_path?: string | null } | null)?.logo_path);
  return { ...(data as Omit<OrgBranding, "logo">), logo };
}

/**
 * Firma formundaki logo alanını uygular: "" değişmez, "remove" kaldırır, data URL yeni logoyu yükler (eskisi silinir).
 * Çağıran organizations.manage yetkisini doğrulamış olmalı. Hata metni ya da null döner.
 */
export async function applyOrgLogo(orgId: string, value: string, actorId?: string): Promise<string | null> {
  if (!value) return null;
  const admin = createAdminClient(actorId);
  const { data: cur, error: readErr } = await admin.from("organizations").select("logo_path").eq("id", orgId).maybeSingle();
  if (readErr) return "Logo kaydedilemedi (veritabanı güncellemesi bekleniyor).";
  const old = (cur as { logo_path?: string | null } | null)?.logo_path ?? null;

  let path: string | null = null;
  if (value !== "remove") {
    const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(value);
    if (!m) return "Logo PNG veya JPG olmalı.";
    const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
    const mime = sniffLogo(bytes);
    if (!mime) return "Logo dosyası okunamadı; PNG veya JPG yükleyin.";
    if (bytes.length > ORG_LOGO_MAX) return "Logo en fazla 500 KB olabilir.";
    path = `organizations/logo/${orgId}-${crypto.randomUUID()}.${ORG_LOGO_TYPES[mime]}`;
    const { error } = await admin.storage.from("documents").upload(path, bytes, { contentType: mime, upsert: false });
    if (error) return "Logo yüklenemedi.";
  }
  const { error } = await admin.from("organizations").update({ logo_path: path }).eq("id", orgId);
  if (error) {
    if (path) await admin.storage.from("documents").remove([path]);
    return "Logo kaydedilemedi.";
  }
  if (old) await admin.storage.from("documents").remove([old]);
  return null;
}
