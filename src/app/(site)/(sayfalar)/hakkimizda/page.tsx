import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, ListChecks, ShieldCheck, Zap } from "lucide-react";
import { CompanyAddress, Fact, PageHero } from "@/components/site/parts";
import { BRAND, BRAND_FOOTER, BRAND_TAGLINE } from "@/lib/brand";
import { COMPANY, has, mailHref } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Hakkımızda",
  description: `${BRAND}: güvenlik, temizlik, danışma ve tesis yönetimi personel operasyonlarını şeffaf ve düzenli biçimde yöneten operasyonel personel süreç yönetimi platformu.`,
  path: "/hakkimizda",
});

// Not: Yalnızca ürünün bugün yaptıkları anlatılır. Kuruluş yılı, müşteri sayısı, sertifika gibi bilgiler şirket
// tarafından verilmeden eklenmemeli.
const values = [
  {
    icon: ShieldCheck,
    title: "Daha güvenli",
    text: "Her hesap yalnızca yetkili olduğu firma ve projeleri görür. Personelin kişisel bilgileri müşteri hesaplarına kapalıdır; yapılan değişiklikler kayıt altına alınır.",
  },
  {
    icon: ListChecks,
    title: "Daha düzenli",
    text: "Özlük evrakı, puantaj, izin, bordro, fatura ve devriye kayıtları dağınık dosyalar yerine tek yerde, proje ve hizmet alanına göre düzenli durur.",
  },
  {
    icon: Zap,
    title: "Daha verimli",
    text: "Yasal izin hakkı hesabı, toplu personel aktarımı, QR ile devriye ve hazır form şablonları tekrar eden işleri kısaltır.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="Hakkımızda"
        path="/hakkimizda"
        lead={<>{BRAND} — {BRAND_TAGLINE}. Sitelerin ve firmaların personel operasyonlarını tek platformda, şeffaf biçimde yönetmek için çalışıyoruz.</>}
      />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <section aria-labelledby="biz-baslik" className="space-y-4 text-base leading-relaxed text-fg/85">
            <h2 id="biz-baslik" className="text-2xl font-bold text-navy">Biz kimiz?</h2>
            <p>
              {BRAND}, <Fact value={COMPANY.legalName} /> tarafından işletilen bir operasyonel personel süreç yönetimi platformudur.
              Güvenlik, temizlik, danışma, tesis yönetimi ve teknik personel hizmetlerinde personelin günlük yönetimini ve bu
              yönetimin bütün kayıtlarını tek bir yerde toplar.
            </p>
            <p>
              Sahada çalışan personelin yönetimi; özlük evrakının eksiksiz tutulmasından puantaja, yıllık izin hakkının doğru
              hesaplanmasından bordroya, denetimlerden devriyeye kadar pek çok ayrıntı içerir. Bu ayrıntılar çoğu zaman e-posta,
              kâğıt ve dağınık dosyalar arasında kaybolur. {BRAND} bunları tek panelde, proje ve hizmet alanına göre düzenler.
            </p>
            <h2 className="pt-4 text-2xl font-bold text-navy">Nasıl çalışıyoruz?</h2>
            <p>
              Yönetim merkezimiz operasyonu sistem üzerinden yürütür: personel kartlarını ve evrakları işler, puantaj ve bordroları
              paylaşır, izinleri ve denetimleri kaydeder, cari hesabı günceller. Müşterilerimiz ise kendilerine tanımlanan
              hesaplarla yalnızca kendi projelerine ait bilgileri, istedikleri an panelden izler.
            </p>
            <p>
              Platform tarayıcı üzerinden çalışır; bilgisayar, tablet ve telefondan kurulum gerektirmeden kullanılır. Devriye gibi
              saha işleri için görevlinin kendi telefonunun kamerası yeterlidir.
            </p>
          </section>

          <aside aria-labelledby="sirket-baslik" className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 id="sirket-baslik" className="text-lg font-bold text-navy">Şirket bilgileri</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Unvan", <Fact key="u" value={COMPANY.legalName} />],
                ["Adres", <CompanyAddress key="a" />],
                ["E-posta", <Fact key="e" value={COMPANY.email} href={mailHref()} />],
                ...(
                  [
                    ["Vergi dairesi", COMPANY.taxOffice],
                    ["Vergi no", COMPANY.taxNumber],
                    ["MERSİS no", COMPANY.mersis],
                    ["Ticaret sicil no", COMPANY.tradeRegistry],
                    ["KEP adresi", COMPANY.kep],
                  ] as [string, string][]
                ).filter(([, v]) => has(v)),
              ].map(([k, val]) => (
                <div key={String(k)}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium text-fg [overflow-wrap:anywhere]">{val}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <section aria-labelledby="ilkeler-baslik" className="mt-16">
          <h2 id="ilkeler-baslik" className="text-2xl font-bold text-navy">İlkelerimiz</h2>
          <p className="mt-2 text-lg italic text-navy/80">{BRAND_FOOTER}</p>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {values.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-border bg-surface p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden><Icon className="size-5" /></span>
                <h3 className="mt-4 font-semibold text-navy">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg/75">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="seffaflik-baslik" className="mt-16 grid items-center gap-6 rounded-3xl bg-navy p-8 text-white sm:p-10 md:grid-cols-[1fr_auto]">
          <div>
            <h2 id="seffaflik-baslik" className="flex items-center gap-2 text-2xl font-bold">
              <Eye className="size-6 text-accent" aria-hidden /> Şeffaf yönetim
            </h2>
            <p className="mt-2 max-w-2xl text-white/80">
              Projelerinizde neler olup bittiğini görmek için bizi aramanıza gerek kalmasın. Size uygun yapıyı birlikte kuralım.
            </p>
          </div>
          <Link href="/iletisim" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-semibold text-accent-fg hover:brightness-105">
            Bizimle iletişime geçin <ArrowRight className="size-5" aria-hidden />
          </Link>
        </section>
      </div>
    </>
  );
}
