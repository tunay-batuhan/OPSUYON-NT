import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td } from "@/components/ui";
import { FilterBar, yearOptions, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireStaff } from "@/lib/auth";
import { str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MONTHS, formatDate, formatDateTime } from "@/lib/format";
import { fold } from "@/lib/text";
import type { AuditLog } from "@/lib/types";

export const metadata: Metadata = { title: "İşlem geçmişi" };

const PATH = "/merkez/islem-gecmisi";

/** İşlem geçmişi tutulan tablolar (app.audit_row tetikleyicisi bağlı olanlar). */
const tableNames: Record<string, string> = {
  organizations: "Firma",
  projects: "Proje",
  profiles: "Kullanıcı",
  project_members: "Proje erişimi",
  member_permission_overrides: "İzin istisnası (müşteri)",
  staff_permission_overrides: "İzin istisnası (merkez)",
  personnel: "Personel",
  personnel_assignments: "Personel ataması",
  documents: "Belge",
  leave_records: "İzin kaydı",
  ledger_statements: "Cari hesap ekstresi",
  firm_ledger_entries: "Cari hareket (fatura / tahsilat)",
  invoices: "Fatura",
  payments: "Ödeme",
  app_modules: "Müşteri modülü",
  patrol_points: "Devriye noktası",
  form_templates: "Form şablonu",
};
const actionTone = { INSERT: "success", UPDATE: "brand", DELETE: "danger" } as const;
const actionLabel = { INSERT: "Eklendi", UPDATE: "Güncellendi", DELETE: "Silindi" } as const;

type Row = AuditLog & { old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; actor_note?: string | null };
type Actor = { id: string; full_name: string; username: string; kind: "staff" | "customer"; organizations: { name: string } | null };

/** PostgREST `ilike` / `.or()` içinde anlamı olan karakterleri temizler. */
const likeTerm = (s: string | undefined) => (s ?? "").replace(/[%_*,()\\"]/g, "").trim();

/** Kaydın okunur adı: ad / başlık / ad soyad… (silinen kayıtta eski veriden). */
function recordLabel(l: Row): string | null {
  const d = l.new_data ?? l.old_data;
  if (!d) return null;
  for (const k of ["name", "title", "full_name", "invoice_no", "file_name", "username", "code"]) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Alan adlarının okunur karşılığı; listede olmayanlar alt çizgisiz gösterilir. */
const fieldLabels: Record<string, string> = {
  name: "Ad", title: "Başlık", full_name: "Ad soyad", first_name: "Ad", last_name: "Soyad", username: "Kullanıcı adı", email: "E-posta", phone: "Telefon",
  status: "Durum", is_active: "Aktif", customer_visible: "Müşteri görebilir", enabled: "Açık", description: "Açıklama", address: "Adres", code: "Kod",
  category_code: "Kategori", file_name: "Dosya", period_year: "Yıl", period_month: "Ay", start_date: "Başlangıç", end_date: "Bitiş", hire_date: "İşe giriş",
  termination_date: "İşten çıkış", service_line: "Hizmet alanı", role_id: "Rol", project_id: "Proje", organization_id: "Firma", personnel_id: "Personel",
  leave_type: "İzin türü", days: "Gün", amount: "Tutar", due_date: "Vade", paid_at: "Ödeme tarihi", invoice_no: "Fatura no", note: "Not", notes: "Not",
  sort_order: "Sıra", lat: "Enlem", lng: "Boylam", national_id: "TC kimlik", iban: "IBAN", birth_date: "Doğum tarihi", metadata: "Ek bilgi",
  last_login_at: "Son giriş", restricted: "Kısıtlı", kind: "Tür", staff_role_id: "Merkez rolü", must_change_password: "Parola değiştirmeli",
};
/** Gösterilmeyen alanlar: kimlikler, zaman damgaları, depolama yolu gibi okuyucuya bir şey söylemeyenler. */
const hiddenFields = new Set(["id", "created_at", "updated_at", "uploaded_by", "created_by", "storage_path", "storage_bucket", "size_bytes", "mime_type", "search", "password_hash"]);
const statusLabels: Record<string, string> = { active: "Aktif", passive: "Pasif", paused: "Duraklatıldı", closed: "Pasif", terminated: "Ayrıldı", suspended: "Askıda", archived: "Arşiv", restricted: "Kısıtlı" };

function fmtValue(k: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (k === "status" && typeof v === "string") return statusLabels[v] ?? v;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v);
  if (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v)) return v.slice(0, 8);
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 79) + "…" : s;
}
const fieldLabel = (k: string) => fieldLabels[k] ?? k.replace(/_/g, " ");

type Change = { label: string; from?: string; to: string };

/**
 * Kaydın ne olduğunu / nesinin değiştiğini özetler:
 *   Eklendi → kaydın anlamlı alanları; Güncellendi → yalnızca değişen alanlar (eski → yeni); Silindi → silinen kaydın alanları.
 */
function describe(l: Row): Change[] {
  const o = l.old_data ?? {};
  const n = l.new_data ?? {};
  if (l.action === "UPDATE") {
    return Object.keys({ ...o, ...n })
      .filter((k) => !hiddenFields.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
      .map((k) => ({ label: fieldLabel(k), from: fmtValue(k, o[k]), to: fmtValue(k, n[k]) }));
  }
  const d = l.action === "INSERT" ? n : o;
  return Object.keys(d)
    .filter((k) => !hiddenFields.has(k) && d[k] !== null && d[k] !== "" && !(typeof d[k] === "object" && d[k] !== null && Object.keys(d[k] as object).length === 0))
    .map((k) => ({ label: fieldLabel(k), to: fmtValue(k, d[k]) }));
}
const SHOW = 3;

export default async function AuditPage({ searchParams }: PageProps<"/merkez/islem-gecmisi">) {
  await requireStaff("audit.read");
  // pg_cron yoksa yedek: 1 aydan eski kayıtları sayfa yanıtı gittikten sonra temizle
  after(async () => {
    await createAdminClient().rpc("purge_old_audit_logs");
  });
  const sp = await searchParams;
  const tabloRaw = str1(sp.tablo);
  const tablo = tabloRaw && Object.hasOwn(tableNames, tabloRaw) ? tabloRaw : undefined;
  const islemRaw = str1(sp.islem);
  const islem = islemRaw && Object.hasOwn(actionLabel, islemRaw) ? islemRaw : undefined;
  const kisi = (str1(sp.kisi) ?? "").trim();
  const kisiTerm = likeTerm(kisi);
  const monthNum = Number(str1(sp.ay));
  const month = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : undefined;
  const yearNum = Number(str1(sp.yil));
  // Yalnızca ay seçildiyse içinde bulunulan yıl esas alınır (Yıl kutusunda da o yıl görünür)
  const year = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100 ? yearNum : month ? new Date().getFullYear() : undefined;
  const paging = pagingFrom(sp);
  const supabase = await createClient();

  // Kişi araması: ad soyad, kullanıcı adı veya firma adına uyan hesaplar; "Sistem" yazılırsa otomatik işlemler,
  // "devriye" gibi bir not yazılırsa hesapsız işlemler (ör. devriye okutması: personel adı)
  let actorIdsFilter: string[] | null = null;
  const systemToo = Boolean(kisiTerm) && "sistem".startsWith(fold(kisiTerm));
  if (kisiTerm) {
    const { data: orgs } = await supabase.from("organizations").select("id").ilike("name", `%${kisiTerm}%`).limit(50);
    const orgIds = (orgs ?? []).map((o) => o.id as string);
    const { data: matched } = await supabase
      .from("profiles")
      .select("id")
      .or([`full_name.ilike.%${kisiTerm}%`, `username.ilike.%${kisiTerm}%`, ...(orgIds.length ? [`organization_id.in.(${orgIds.join(",")})`] : [])].join(","))
      .limit(500);
    actorIdsFilter = (matched ?? []).map((m) => m.id as string);
  }

  let logs: Row[] = [];
  let total = 0;
  // actor_note sütunu 20261109000300 migration'ıyla gelir; henüz çalıştırılmadıysa sayfa onsuz da açılsın
  const query = (withNote: boolean) => {
    let q = supabase
      .from("audit_logs")
      .select(`id, at, actor_id, action, table_name, record_id, old_data, new_data${withNote ? ", actor_note" : ""}`, { count: "exact" })
      .order("at", { ascending: false })
      .order("id", { ascending: false })
      .range(paging.from, paging.to);
    if (tablo) q = q.eq("table_name", tablo);
    if (islem) q = q.eq("action", islem);
    if (actorIdsFilter) {
      const parts = [
        actorIdsFilter.length ? `actor_id.in.(${actorIdsFilter.join(",")})` : null,
        systemToo ? "actor_id.is.null" : null,
        withNote ? `actor_note.ilike.%${kisiTerm}%` : null,
      ].filter(Boolean);
      q = q.or(parts.join(","));
    }
    if (year) {
      // Türkiye saati (UTC+3) ile ay / yıl sınırları
      const start = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
      const end = month ? (month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`) : `${year + 1}-01-01`;
      q = q.gte("at", `${start}T00:00:00+03:00`).lt("at", `${end}T00:00:00+03:00`);
    }
    return q;
  };
  let res = await query(true);
  if (res.error) res = await query(false);
  logs = (res.data ?? []) as unknown as Row[];
  total = res.count ?? 0;
  if (paging.page > 1 && logs.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total) : 1));

  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name, username, kind, organizations(name)").in("id", actorIds) : { data: [] };
  const people = new Map(((actors ?? []) as unknown as Actor[]).map((a) => [a.id, a]));

  const fields: FilterField[] = [
    {
      name: "tablo", label: "Kayıt türü", value: tablo, all: "Tümü",
      options: Object.entries(tableNames).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "tr")),
    },
    { name: "islem", label: "İşlem", value: islem, all: "Tümü", options: Object.entries(actionLabel).map(([value, label]) => ({ value, label })) },
    { name: "kisi", label: "Kişi", kind: "text", value: kisi, placeholder: "Ad, kullanıcı adı veya firma…" },
    { name: "ay", label: "Ay", value: month ? String(month) : undefined, all: "Tümü", options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
    { name: "yil", label: "Yıl", value: year ? String(year) : undefined, all: "Tümü", options: yearOptions() },
  ];
  const filtered = Boolean(tablo || islem || kisiTerm || year);

  return (
    <>
      <PageHeader title="İşlem geçmişi" description="Kim, neyi, ne zaman değiştirdi — en yeniden eskiye. Kayıtlar elle silinemez ve değiştirilemez; 1 aydan eskiler otomatik temizlenir." />
      <FilterBar action={PATH} fields={fields} />
      <Card>
        <CardHeader title={`${total} kayıt`} />
        {logs.length === 0 ? (
          <EmptyState title={filtered ? "Filtrelere uyan kayıt yok" : "Kayıt yok"} />
        ) : (
          <Table head={["Zaman", "Kullanıcı", "İşlem", "Kayıt türü", "Kayıt", "Ne değişti"]}>
            {logs.map((l) => {
              const who = l.actor_id ? people.get(l.actor_id) : undefined;
              const name = recordLabel(l);
              const changes = describe(l);
              const line = (c: Change) => (
                <span key={c.label}>
                  <span className="text-muted">{c.label}:</span>{" "}
                  {c.from !== undefined ? (
                    <><span className="line-through decoration-danger/60">{c.from}</span> → <span className="font-medium">{c.to}</span></>
                  ) : (
                    <span className="font-medium">{c.to}</span>
                  )}
                </span>
              );
              return (
                <tr key={l.id}>
                  <td className={td + " whitespace-nowrap"}>{formatDateTime(l.at)}</td>
                  <td className={td}>
                    {l.actor_id ? (
                      <>
                        <p className="font-medium">@{who?.username ?? "silinmiş hesap"}</p>
                        <p className="text-xs text-muted">
                          {who?.full_name}
                          {who && <> · {who.kind === "customer" ? (who.organizations?.name ?? "Müşteri") : "Merkez"}</>}
                        </p>
                      </>
                    ) : l.actor_note ? (
                      <>
                        <p className="font-medium">{l.actor_note}</p>
                        <p className="text-xs text-muted">Hesapsız işlem</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Sistem</p>
                        <p className="text-xs text-muted">Otomatik / veritabanı</p>
                      </>
                    )}
                  </td>
                  <td className={td}><Badge tone={actionTone[l.action]}>{actionLabel[l.action]}</Badge></td>
                  <td className={td}>{tableNames[l.table_name] ?? l.table_name}</td>
                  <td className={td}>
                    {name && <p className="max-w-xs truncate">{name}</p>}
                    {l.record_id && <p className="font-mono text-xs text-muted">{l.record_id.slice(0, 8)}</p>}
                    {!name && !l.record_id && "—"}
                  </td>
                  <td className={td + " max-w-md text-xs"}>
                    {changes.length === 0 ? (
                      <span className="text-muted">{l.action === "UPDATE" ? "Görünür bir alan değişmedi" : "—"}</span>
                    ) : changes.length <= SHOW ? (
                      <div className="flex flex-col gap-0.5">{changes.map(line)}</div>
                    ) : (
                      <details className="group">
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex flex-col gap-0.5">{changes.slice(0, SHOW).map(line)}</div>
                          <span className="mt-0.5 inline-block text-brand group-open:hidden">+{changes.length - SHOW} alan daha</span>
                          <span className="mt-0.5 hidden text-brand group-open:inline-block">Daha az göster</span>
                        </summary>
                        <div className="mt-0.5 flex flex-col gap-0.5">{changes.slice(SHOW).map(line)}</div>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        <Pagination path={PATH} searchParams={sp} total={total} />
      </Card>
    </>
  );
}
