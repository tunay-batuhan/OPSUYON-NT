import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { connection } from "next/server";
import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { CompanyAddress, Fact, PageHero } from "@/components/site/parts";
import { issueFormStamp } from "@/lib/contact";
import { COMPANY, has, mailHref, telHref } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = pageMetadata({
  title: "İletişim",
  description: `${BRAND} için teklif, demo, destek ve diğer talepleriniz için iletişim formu, telefon, e-posta ve adres bilgileri.`,
  path: "/iletisim",
});

/**
 * İletişim. Sayfa istek anında üretilir: forma, sunucunun o an imzaladığı zaman damgası konur (en az 3 sn
 * sonra gönderilebilir; JavaScript olmadan da çalışır). `?konu=demo` gibi bir adres konuyu önceden seçer.
 */
export default async function ContactPage({ searchParams }: PageProps<"/iletisim">) {
  await connection();
  const sp = await searchParams;
  const konu = typeof sp.konu === "string" ? sp.konu : undefined;
  const stamp = issueFormStamp();

  const rows = [
    { icon: MapPin, label: "Adres", value: <CompanyAddress /> },
    has(COMPANY.phone) && { icon: Phone, label: "Telefon", value: <Fact value={COMPANY.phone} href={telHref()} className="font-semibold text-brand-hover underline-offset-2 hover:underline" /> },
    { icon: Mail, label: "E-posta", value: <Fact value={COMPANY.email} href={mailHref()} className="font-semibold text-brand-hover underline-offset-2 hover:underline" /> },
    has(COMPANY.workingHours) && { icon: Clock, label: "Çalışma saatleri", value: <Fact value={COMPANY.workingHours} /> },
  ].filter((r) => !!r);
  // Şirket bilgileri kutusu: unvan + doldurulmuş isteğe bağlı alanlar
  const facts: [string, string][] = (
    [["Vergi dairesi", COMPANY.taxOffice], ["Vergi no", COMPANY.taxNumber], ["MERSİS", COMPANY.mersis], ["Ticaret sicil no", COMPANY.tradeRegistry], ["KEP", COMPANY.kep]] as [string, string][]
  ).filter(([, v]) => has(v));

  return (
    <>
      <PageHero
        title="İletişim"
        path="/iletisim"
        lead="Teklif, demo, destek ya da aklınıza takılan her konuda bize yazın. Mesajınızı inceleyip en kısa sürede dönüş yapıyoruz."
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:py-16">
        <section aria-labelledby="bilgiler-baslik">
          <h2 id="bilgiler-baslik" className="text-xl font-bold text-navy">İletişim bilgileri</h2>
          <address className="mt-5 space-y-3 not-italic">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="site-lift flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-[0_6px_14px_-4px_color-mix(in_oklab,var(--brand)_60%,transparent)]" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
                  <p className="mt-0.5 text-fg">{value}</p>
                </div>
              </div>
            ))}
          </address>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
            <h3 className="flex items-center gap-2 font-semibold text-navy">
              <Building2 className="size-5 text-brand-hover" aria-hidden /> Şirket bilgileri
            </h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Unvan</dt><dd className="[overflow-wrap:anywhere]"><Fact value={COMPANY.legalName} /></dd>
              {facts.map(([k, v]) => (
                <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="[overflow-wrap:anywhere]">{v}</dd></Fragment>
              ))}
            </dl>
          </div>

          <p className="mt-6 rounded-2xl border border-brand/15 bg-brand-soft/60 p-4 text-sm leading-relaxed text-fg/80">
            <strong className="font-semibold text-navy">Müşterimiz misiniz?</strong>{" "}
            <Link href="/giris" className="font-semibold text-brand-hover underline underline-offset-2 hover:text-navy">Giriş sayfasından</Link>{" "}
            panelinize ulaşabilirsiniz. Parolanızı unuttuysanız bu formdan “Destek” konusuyla yazın; parolanız yönetim merkezi tarafından sıfırlanır.
          </p>
        </section>

        <section aria-labelledby="form-baslik" className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-[0_2px_4px_rgb(12_31_69/0.05),0_24px_48px_-16px_rgb(12_31_69/0.2)] sm:p-8">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand via-navy to-accent" />
          <h2 id="form-baslik" className="text-xl font-bold text-navy">Bize yazın</h2>
          <p className="mb-6 mt-1 text-sm text-muted">Formdaki bilgiler yalnızca talebinizi yanıtlamak için kullanılır.</p>
          <ContactForm stamp={stamp} defaultTopic={konu} />
        </section>
      </div>
    </>
  );
}
