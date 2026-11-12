import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, td } from "@/components/ui";
import { FilterBar, type FilterField } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { requireSuperAdmin } from "@/lib/auth";
import { str1 } from "@/lib/lookups";
import { pageCount, pageHref, pagingFrom } from "@/lib/paging";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { CONTACT_STATUS, CONTACT_TOPICS, isContactStatus, isContactTopic } from "@/lib/schemas-contact";
import { STATUS_TONE, type ContactMessage } from "./shared";

export const metadata: Metadata = { title: "İletişim talepleri" };

const PATH = "/merkez/iletisim-talepleri";

/** PostgREST `ilike` / `.or()` içinde anlamı olan karakterleri temizler. */
const likeTerm = (s: string | undefined) => (s ?? "").replace(/[%_*,()\\"]/g, "").trim();

/**
 * Web sitesindeki iletişim formundan gelen mesajlar (contact_messages). Tabloya anonim/oturumlu erişim yoktur;
 * okuma servis anahtarıyla, YALNIZCA Süper Yönetici olduğu doğrulandıktan sonra yapılır.
 */
export default async function ContactInboxPage({ searchParams }: PageProps<"/merkez/iletisim-talepleri">) {
  await requireSuperAdmin();
  // pg_cron yoksa yedek: saklama süresi dolanları yanıt gittikten sonra temizle
  after(async () => {
    await createAdminClient().rpc("purge_old_contact_messages");
  });

  const sp = await searchParams;
  const durumRaw = str1(sp.durum);
  const durum = isContactStatus(durumRaw) ? durumRaw : undefined;
  const konuRaw = str1(sp.konu);
  const konu = isContactTopic(konuRaw) ? konuRaw : undefined;
  const ara = (str1(sp.ara) ?? "").trim().slice(0, 60);
  const term = likeTerm(ara);
  const paging = pagingFrom(sp);

  const admin = createAdminClient();
  let q = admin
    .from("contact_messages")
    .select("id, full_name, company, email, phone, topic, message, status, created_at, updated_at, handled_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(paging.from, paging.to);
  if (durum) q = q.eq("status", durum);
  if (konu) q = q.eq("topic", konu);
  if (term) q = q.or([`full_name.ilike.%${term}%`, `email.ilike.%${term}%`, `company.ilike.%${term}%`].join(","));
  const { data, count } = await q;
  const rows = (data ?? []) as ContactMessage[];
  const total = count ?? 0;
  if (paging.page > 1 && rows.length === 0) redirect(pageHref(PATH, sp, total ? pageCount(total) : 1));

  const { count: newCount } = await admin.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "yeni");

  const fields: FilterField[] = [
    { name: "durum", label: "Durum", value: durum, all: "Tümü", options: Object.entries(CONTACT_STATUS).map(([value, label]) => ({ value, label })) },
    { name: "konu", label: "Konu", value: konu, all: "Tümü", options: Object.entries(CONTACT_TOPICS).map(([value, label]) => ({ value, label })) },
    { name: "ara", label: "Gönderen", kind: "text", value: ara, placeholder: "Ad, e-posta veya firma…" },
  ];
  const filtered = Boolean(durum || konu || term);

  return (
    <>
      <PageHeader
        title="İletişim talepleri"
        description="Web sitesindeki iletişim formundan gelen mesajlar — en yeniden eskiye. Mesajlar 12 ay sonra otomatik silinir. Bu ekranı yalnızca Süper Yönetici görür."
      />
      <FilterBar action={PATH} fields={fields} />
      <Card>
        <CardHeader title={`${total} mesaj`} description={newCount ? `${newCount} yeni mesaj var` : "Yeni mesaj yok"} />
        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "Filtrelere uyan mesaj yok" : "Henüz mesaj yok"}
            description={filtered ? undefined : "İletişim sayfasındaki formdan gönderilen mesajlar burada listelenir."}
          />
        ) : (
          <Table head={["Tarih", "Gönderen", "Konu", "Mesaj", "Durum"]}>
            {rows.map((m) => (
              <tr key={m.id} className={m.status === "yeni" ? "bg-brand-soft/30" : undefined}>
                <td className={td + " whitespace-nowrap text-sm"}>{formatDateTime(m.created_at)}</td>
                <td className={td}>
                  <Link href={`${PATH}/${m.id}`} className={`hover:text-brand hover:underline ${m.status === "yeni" ? "font-semibold" : "font-medium"}`}>
                    {m.full_name}
                  </Link>
                  <p className="text-xs text-muted [overflow-wrap:anywhere]">{m.company ? `${m.company} · ` : ""}{m.email}</p>
                </td>
                <td className={td + " whitespace-nowrap"}>{CONTACT_TOPICS[m.topic] ?? m.topic}</td>
                <td className={td + " max-w-sm"}>
                  <Link href={`${PATH}/${m.id}`} className="line-clamp-2 text-sm text-fg/80 hover:text-fg">{m.message}</Link>
                </td>
                <td className={td}><Badge tone={STATUS_TONE[m.status]}>{CONTACT_STATUS[m.status]}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination path={PATH} searchParams={sp} total={total} />
      </Card>
    </>
  );
}
