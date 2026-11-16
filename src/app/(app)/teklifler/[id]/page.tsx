import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Eye, FileDown, Pencil, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, btn, cn } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { OfferResult } from "@/components/offers/offer-result";
import { deleteOffer, setOfferStatus } from "@/app/actions/offers";
import { hasPermission, requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { OFFER_STATUS, calcOffer, type OfferStatus } from "@/lib/offer-calc";
import { loadOffer } from "../data";

export const metadata: Metadata = { title: "Teklif" };

/** Durum düğmeleri: o anki durumun dışındakiler. */
const STATUS_ACTIONS: { status: OfferStatus; label: string; cls: string }[] = [
  { status: "sent", label: "Gönderildi", cls: btn("secondary", "md") },
  { status: "accepted", label: "Kabul edildi", cls: cn(btn("secondary", "md"), "border-success/40 text-success hover:bg-success-soft") },
  { status: "rejected", label: "Reddedildi", cls: cn(btn("secondary", "md"), "border-danger/40 text-danger hover:bg-danger-soft") },
  { status: "draft", label: "Taslağa al", cls: btn("ghost", "md") },
];

/**
 * Teklif sayfası: kâr tablosu (tabletteki hesabın aynısı, kayıtlı tutarlarla), müşteri bilgileri, durum,
 * PDF indir / görüntüle, düzenle ve sil.
 */
export default async function OfferPage({ params }: PageProps<"/teklifler/[id]">) {
  const { id } = await params;
  const user = await requireStaff();
  const manage = hasPermission(user, "offers.manage");
  if (!manage && !hasPermission(user, "offers.read")) redirect("/merkez?yetki=yok");
  const data = await loadOffer(id);
  if (!data) notFound();
  const { offer: o, lines, creator } = data;
  // tablo, kayıtlı satırlarla yeniden çizilir (tutarlar kayıtla aynı fonksiyondan)
  const calc = calcOffer(lines, o.vat_rate, o.fee_per_person);
  const s = OFFER_STATUS[o.status];

  const info: [string, ReactNode][] = [
    ["Yetkili", o.contact_name],
    ["Telefon", o.phone && <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} className="text-brand-hover hover:underline">{o.phone}</a>],
    ["E-posta", o.email && <a href={`mailto:${o.email}`} className="text-brand-hover hover:underline">{o.email}</a>],
    ["Adres", o.address],
    ["Geçerlilik", o.valid_until ? formatDate(o.valid_until) : null],
    ["Hazırlayan", creator],
    ["Oluşturma", formatDateTime(o.created_at)],
    ["Karar tarihi", o.decided_at ? formatDateTime(o.decided_at) : null],
  ];

  return (
    <>
      <Link href="/teklifler" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> Teklifler
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`${o.offer_no} · ${o.customer_name}`}
              description={`${calc.total_people} kişi · aylık matrah ${formatMoney(calc.monthly_base)} · yıllık net kâr ${formatMoney(calc.yearly_profit)}`}
              action={<Badge tone={s.tone}>{s.label}</Badge>}
            />
            <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
              {info.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">{v || "—"}</dd>
                </div>
              ))}
              {o.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Not</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{o.notes}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              <a href={`/api/teklifler/${o.id}/pdf`} className={btn("primary", "md")}>
                <FileDown className="size-4" aria-hidden /> PDF indir
              </a>
              <a href={`/api/teklifler/${o.id}/pdf?goster=1`} target="_blank" rel="noopener" className={btn("secondary", "md")}>
                <Eye className="size-4" aria-hidden /> PDF görüntüle
              </a>
              {manage && (
                <Link href={`/teklifler/${o.id}/duzenle`} className={btn("secondary", "md")}>
                  <Pencil className="size-4" aria-hidden /> Düzenle
                </Link>
              )}
            </div>
          </Card>

          {manage && (
            <Card>
              <CardHeader title="Durum" description="Teklif müşteriye iletilince “Gönderildi”, müşteri karar verince “Kabul edildi” ya da “Reddedildi” yapın. Raporlar bu duruma göre sayar." />
              <div className="flex flex-wrap gap-2 p-5">
                {STATUS_ACTIONS.filter((a) => a.status !== o.status).map((a) => (
                  <form key={a.status} action={setOfferStatus}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="status" value={a.status} />
                    <button className={a.cls}>{a.label}</button>
                  </form>
                ))}
              </div>
              <div className="border-t border-border px-5 py-4">
                <form action={deleteOffer}>
                  <input type="hidden" name="id" value={o.id} />
                  <ConfirmSubmit
                    title={`“${o.offer_no}” teklifi silinsin mi?`}
                    description="Teklif ve hizmet satırları kalıcı olarak silinir; raporlardan da çıkar."
                    items={[`${o.offer_no} · ${o.customer_name}`]}
                    confirmLabel="Sil"
                    icon={<Trash2 className="size-4" aria-hidden />}
                    className={btn("danger", "sm")}
                  >
                    Teklifi sil
                  </ConfirmSubmit>
                </form>
              </div>
            </Card>
          )}
        </div>

        <OfferResult calc={calc} vatRate={o.vat_rate} fee={o.fee_per_person} className="xl:sticky xl:top-20 xl:self-start" />
      </div>
    </>
  );
}
