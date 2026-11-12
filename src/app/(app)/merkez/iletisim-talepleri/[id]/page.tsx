import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Check, CheckCheck, Mail, Phone, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, btn } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { CONTACT_STATUS, CONTACT_TOPICS, type ContactStatus } from "@/lib/schemas-contact";
import { deleteContactMessage, setContactMessageStatus } from "@/app/actions/contact";
import { BRAND } from "@/lib/brand";
import { STATUS_TONE, type ContactMessage } from "../shared";

export const metadata: Metadata = { title: "İletişim talebi" };

const PATH = "/merkez/iletisim-talepleri";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function StatusButton({ id, status, children, primary }: { id: string; status: ContactStatus; children: React.ReactNode; primary?: boolean }) {
  return (
    <form action={setContactMessageStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={btn(primary ? "primary" : "secondary", "md")}>{children}</button>
    </form>
  );
}

export default async function ContactMessagePage({ params }: PageProps<"/merkez/iletisim-talepleri/[id]">) {
  await requireSuperAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("contact_messages")
    .select("id, full_name, company, email, phone, topic, message, status, created_at, updated_at, handled_at, handled_by")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const m = data as ContactMessage;
  const { data: handler } = m.handled_by
    ? await admin.from("profiles").select("full_name").eq("id", m.handled_by).maybeSingle()
    : { data: null };

  const topic = CONTACT_TOPICS[m.topic] ?? m.topic;
  const quoted = m.message.split("\n").map((l) => `> ${l}`).join("\n");
  const reply = `mailto:${m.email}?subject=${encodeURIComponent(`${BRAND} — ${topic} talebiniz`)}&body=${encodeURIComponent(
    `Merhaba ${m.full_name},\n\n\n\n---\n${formatDateTime(m.created_at)} tarihli mesajınız:\n${quoted}`,
  )}`;
  const tel = m.phone ? `tel:${m.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <>
      <Link href={PATH} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> İletişim talepleri
      </Link>
      <PageHeader
        title={m.full_name}
        description={`${topic} · ${formatDateTime(m.created_at)}`}
        actions={<Badge tone={STATUS_TONE[m.status]}>{CONTACT_STATUS[m.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title="Mesaj" />
          <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed [overflow-wrap:anywhere]">{m.message}</p>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Gönderen" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div><dt className="text-muted">Ad soyad</dt><dd className="font-medium">{m.full_name}</dd></div>
              {m.company && <div><dt className="text-muted">Firma</dt><dd className="font-medium">{m.company}</dd></div>}
              <div>
                <dt className="text-muted">E-posta</dt>
                <dd className="[overflow-wrap:anywhere]"><a href={`mailto:${m.email}`} className="font-medium text-brand hover:underline">{m.email}</a></dd>
              </div>
              {m.phone && tel && (
                <div><dt className="text-muted">Telefon</dt><dd><a href={tel} className="font-medium text-brand hover:underline">{m.phone}</a></dd></div>
              )}
              <div><dt className="text-muted">Konu</dt><dd className="font-medium">{topic}</dd></div>
              {m.handled_at && (
                <div>
                  <dt className="text-muted">Son durum değişikliği</dt>
                  <dd>{formatDateTime(m.handled_at)}{handler?.full_name ? ` · ${handler.full_name}` : ""}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="İşlemler" />
            <div className="flex flex-col gap-3 px-5 py-4">
              <a href={reply} className={btn("primary", "md")}>
                <Mail className="size-4" aria-hidden /> E-posta ile yanıtla
              </a>
              {tel && (
                <a href={tel} className={btn("secondary", "md")}>
                  <Phone className="size-4" aria-hidden /> Ara
                </a>
              )}
              <p className="text-xs text-muted">Yanıtladıktan sonra durumu “Yanıtlandı” yapmayı unutmayın.</p>
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {m.status !== "okundu" && (
                  <StatusButton id={m.id} status="okundu"><Check className="size-4" aria-hidden /> Okundu</StatusButton>
                )}
                {m.status !== "yanitlandi" && (
                  <StatusButton id={m.id} status="yanitlandi" primary={m.status === "okundu"}><CheckCheck className="size-4" aria-hidden /> Yanıtlandı</StatusButton>
                )}
                {m.status !== "yeni" && (
                  <StatusButton id={m.id} status="yeni"><RotateCcw className="size-4" aria-hidden /> Yeni yap</StatusButton>
                )}
              </div>
              <form action={deleteContactMessage} className="border-t border-border pt-3">
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="from" value="detail" />
                <ConfirmSubmit
                  title={`${m.full_name} adlı kişinin mesajı silinsin mi?`}
                  description="Mesaj kalıcı olarak silinir ve geri alınamaz."
                  items={[`${topic} · ${formatDateTime(m.created_at)}`, m.email]}
                  className={btn("danger", "md", "w-full")}
                  icon={<Trash2 className="size-4" aria-hidden />}
                >
                  Mesajı sil
                </ConfirmSubmit>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
