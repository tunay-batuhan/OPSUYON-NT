import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { CompanyAddress, Fact, PageHero } from "@/components/site/parts";
import { issueFormStamp } from "@/lib/contact";
import { COMPANY, mailHref, telHref } from "@/lib/site";
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
    { icon: Phone, label: "Telefon", value: <Fact value={COMPANY.phone} href={telHref()} className="font-medium text-brand underline-offset-2 hover:underline" /> },
    { icon: Mail, label: "E-posta", value: <Fact value={COMPANY.email} href={mailHref()} className="font-medium text-brand underline-offset-2 hover:underline" /> },
    { icon: Clock, label: "Çalışma saatleri", value: <Fact value={COMPANY.workingHours} /> },
  ];

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
          <address className="mt-5 space-y-4 not-italic">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="text-sm text-muted">{label}</p>
                  <p className="text-fg">{value}</p>
                </div>
              </div>
            ))}
          </address>

          <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
            <h3 className="flex items-center gap-2 font-semibold text-navy">
              <Building2 className="size-5 text-brand" aria-hidden /> Şirket bilgileri
            </h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Unvan</dt><dd className="[overflow-wrap:anywhere]"><Fact value={COMPANY.legalName} /></dd>
              <dt className="text-muted">Vergi dairesi</dt><dd><Fact value={COMPANY.taxOffice} /></dd>
              <dt className="text-muted">Vergi no</dt><dd><Fact value={COMPANY.taxNumber} /></dd>
              <dt className="text-muted">MERSİS</dt><dd><Fact value={COMPANY.mersis} /></dd>
              <dt className="text-muted">KEP</dt><dd className="[overflow-wrap:anywhere]"><Fact value={COMPANY.kep} /></dd>
            </dl>
          </div>

          <p className="mt-6 text-sm text-muted">
            Müşterimiz misiniz?{" "}
            <Link href="/giris" className="font-medium text-brand underline underline-offset-2">Giriş sayfasından</Link>{" "}
            panelinize ulaşabilirsiniz. Parolanızı unuttuysanız bu formdan “Destek” konusuyla yazın; parolanız yönetim merkezi tarafından sıfırlanır.
          </p>
        </section>

        <section aria-labelledby="form-baslik" className="relative rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-8">
          <h2 id="form-baslik" className="text-xl font-bold text-navy">Bize yazın</h2>
          <p className="mb-6 mt-1 text-sm text-muted">Formdaki bilgiler yalnızca talebinizi yanıtlamak için kullanılır.</p>
          <ContactForm stamp={stamp} defaultTopic={konu} />
        </section>
      </div>
    </>
  );
}
