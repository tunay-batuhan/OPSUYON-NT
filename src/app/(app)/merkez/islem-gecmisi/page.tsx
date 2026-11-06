import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td } from "@/components/ui";
import { FilterBar, yearOptions, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireStaff } from "@/lib/auth";
import { str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, formatDateTime } from "@/lib/format";
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
  invoices: "Fatura",
  payments: "Ödeme",
  app_modules: "Müşteri modülü",
  patrol_points: "Devriye noktası",
  form_templates: "Form şablonu",
};
const actionTone = { INSERT: "success", UPDATE: "brand", DELETE: "danger" } as const;
const actionLabel = { INSERT: "Eklendi", UPDATE: "Güncellendi", DELETE: "Silindi" } as const;

type Row = AuditLog & { old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null };

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

export default async function AuditPage({ searchParams }: PageProps<"/merkez/islem-gecmisi">) {
  await requireStaff("audit.read");
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

  // Kişi araması: ad soyad veya kullanıcı adına uyan hesaplar; "Sistem" yazılırsa otomatik işlemler
  let actorIdsFilter: string[] | null = null;
  const systemToo = Boolean(kisiTerm) && "sistem".startsWith(fold(kisiTerm));
  if (kisiTerm) {
    const { data: matched } = await supabase
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${kisiTerm}%,username.ilike.%${kisiTerm}%`)
      .limit(200);
    actorIdsFilter = (matched ?? []).map((m) => m.id as string);
  }

  let logs: Row[] = [];
  let total = 0;
  if (!actorIdsFilter || actorIdsFilter.length > 0 || systemToo) {
    let q = supabase
      .from("audit_logs")
      .select("id, at, actor_id, action, table_name, record_id, old_data, new_data", { count: "exact" })
      .order("at", { ascending: false })
      .order("id", { ascending: false })
      .range(paging.from, paging.to);
    if (tablo) q = q.eq("table_name", tablo);
    if (islem) q = q.eq("action", islem);
    if (actorIdsFilter) {
      const parts = [actorIdsFilter.length ? `actor_id.in.(${actorIdsFilter.join(",")})` : null, systemToo ? "actor_id.is.null" : null].filter(Boolean);
      q = q.or(parts.join(","));
    }
    if (year) {
      // Türkiye saati (UTC+3) ile ay / yıl sınırları
      const start = month ? `${year}-${pad(month)}-01` : `${year}-01-01`;
      const end = month ? (month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`) : `${year + 1}-01-01`;
      q = q.gte("at", `${start}T00:00:00+03:00`).lt("at", `${end}T00:00:00+03:00`);
    }
    const { data, count } = await q;
    logs = (data ?? []) as Row[];
    total = count ?? 0;
  }
  if (paging.page > 1 && logs.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total) : 1));

  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name, username").in("id", actorIds) : { data: [] };
  const people = new Map((actors ?? []).map((a) => [a.id as string, a as { id: string; full_name: string; username: string }]));

  const fields: FilterField[] = [
    {
      name: "tablo", label: "Kayıt türü", value: tablo, all: "Tümü",
      options: Object.entries(tableNames).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "tr")),
    },
    { name: "islem", label: "İşlem", value: islem, all: "Tümü", options: Object.entries(actionLabel).map(([value, label]) => ({ value, label })) },
    { name: "kisi", label: "Kişi", kind: "text", value: kisi, placeholder: "Ad veya kullanıcı adı…" },
    { name: "ay", label: "Ay", value: month ? String(month) : undefined, all: "Tümü", options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) },
    { name: "yil", label: "Yıl", value: year ? String(year) : undefined, all: "Tümü", options: yearOptions() },
  ];
  const filtered = Boolean(tablo || islem || kisiTerm || year);

  return (
    <>
      <PageHeader title="İşlem geçmişi" description="Kim, neyi, ne zaman değiştirdi — en yeniden eskiye. Kayıtlar silinemez ve değiştirilemez." />
      <FilterBar action={PATH} fields={fields} />
      <Card>
        <CardHeader title={`${total} kayıt`} />
        {logs.length === 0 ? (
          <EmptyState title={filtered ? "Filtrelere uyan kayıt yok" : "Kayıt yok"} />
        ) : (
          <Table head={["Zaman", "Kullanıcı", "İşlem", "Kayıt türü", "Kayıt"]}>
            {logs.map((l) => {
              const who = l.actor_id ? people.get(l.actor_id) : undefined;
              const name = recordLabel(l);
              return (
                <tr key={l.id}>
                  <td className={td + " whitespace-nowrap"}>{formatDateTime(l.at)}</td>
                  <td className={td}>
                    {l.actor_id ? (who?.full_name ?? "—") : "Sistem"}
                    {who?.username && <p className="text-xs text-muted">@{who.username}</p>}
                  </td>
                  <td className={td}><Badge tone={actionTone[l.action]}>{actionLabel[l.action]}</Badge></td>
                  <td className={td}>{tableNames[l.table_name] ?? l.table_name}</td>
                  <td className={td}>
                    {name && <p className="max-w-xs truncate">{name}</p>}
                    {l.record_id && <p className="font-mono text-xs text-muted">{l.record_id.slice(0, 8)}</p>}
                    {!name && !l.record_id && "—"}
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
