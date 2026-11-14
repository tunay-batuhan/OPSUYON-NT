import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight, BadgeCheck, BookOpen, CalendarCheck, CalendarDays, CalendarOff, ChevronDown, ClipboardCheck, FileStack, FileText, FolderOpen,
  Globe, Lock, MessageSquare, QrCode, Settings, ShieldCheck, Truck, UserRound, Users,
} from "lucide-react";
import { lineColor, LineIcon } from "@/components/ui";
import { Logo } from "@/components/logo";
import { JsonLd } from "@/components/site/parts";
import { AuthButton } from "@/components/site/auth-button";
import { DesktopNav, MobileNav } from "@/components/site/site-nav";
import { PanelPreview } from "@/components/site/panel-preview";
import { PatrolShowcase } from "@/components/site/patrol-showcase";
import { getPublicServiceLines, lineTitle } from "@/lib/lines";
import { BRAND, BRAND_DOMAIN, BRAND_SLOGAN, BRAND_TAGLINE } from "@/lib/brand";
import { faqLd, ldJson, organizationLd, pageMetadata, websiteLd } from "@/lib/seo";

// Hizmet alanları veritabanından gelir (oturumsuz okuma); sayfa statik üretilir, saatte bir yenilenir.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: `${BRAND} — ${BRAND_TAGLINE}`,
  absoluteTitle: true,
  description:
    "Güvenlik, temizlik, danışma ve tesis yönetimi personelinin özlük evrakı, puantaj, izin, bordro, fatura, cari hesap ve QR devriye süreçlerini tek panelde yönetin.",
  path: "/",
});

/** Referans tasarımdaki (docs/tasarim-referans.jpg) alt şerit başlıkları. */
const strip = [
  { icon: UserRound, label: "Personel Tedariki" },
  { icon: Settings, label: "Operasyonel Yönetim" },
  { icon: Truck, label: "Personel Lojistiği" },
  { icon: FileText, label: "Özlük Evrakları ve Sözleşmeler" },
  { icon: CalendarDays, label: "Puantaj ve İzin Takibi" },
  { icon: FolderOpen, label: "Fatura ve Cari Hesap" },
  { icon: ShieldCheck, label: "Yasal Süreç Takibi" },
];

/** Yalnızca portalda GERÇEKTEN olan işlevler (src/lib/assistant/guide.ts ile tutarlı). */
const features = [
  {
    icon: Users,
    title: "Personel ve özlük evrakları",
    text: "Personel kartları, iş sözleşmeleri ve özlük evrakları kategorilere ayrılmış olarak tek yerde. Personel listesi Excel ile toplu aktarılabilir.",
  },
  {
    icon: CalendarCheck,
    title: "Puantaj",
    text: "Proje ve ay bazında puantaj dosyaları. Müşteri, kendi projelerinin puantajını panelinden görüntüler ve indirir.",
  },
  {
    icon: CalendarOff,
    title: "İzin yönetimi",
    text: "Yasal yıllık izin hakkı işe giriş ve doğum tarihinden hesaplanır; hafta tatili ve resmi tatiller düşülür, kalan izin bakiyesi izlenir.",
  },
  {
    icon: BookOpen,
    title: "Bordro, fatura ve cari hesap",
    text: "Bordrolar hizmet bazında paylaşılır. Firma bazlı cari hesapta faturalar, tahsilatlar ve güncel bakiye birlikte görünür.",
  },
  {
    icon: QrCode,
    title: "QR devriye sistemi",
    text: "Uygulama kurmadan, görevlinin telefon kamerasıyla: tur başlatılır, noktalar okutulur, atlanan noktalar ve günlük rapor PDF olarak alınır.",
  },
  {
    icon: ClipboardCheck,
    title: "Denetim, savunma ve eğitim",
    text: "Saha denetimleri, savunma ve ihtar tutanakları, eğitim kayıtları, kıyafet ve ekipman teslimleri personel bazında saklanır.",
  },
  {
    icon: FileStack,
    title: "Risk analizi ve form şablonları",
    text: "Risk analizi belgeleri ve sık kullanılan form şablonları (izin talebi, kıyafet teslim, savunma tutanağı gibi) her an elinizin altında.",
  },
  {
    icon: MessageSquare,
    title: "Mesajlaşma ve bildirimler",
    text: "Müşteri ile yönetim merkezi arasında proje bazlı mesajlaşma; yeni mesaj ve belgeler için bildirim.",
  },
  {
    icon: Lock,
    title: "Rol bazlı yetki ve işlem geçmişi",
    text: "Her hesap yalnızca yetkili olduğu firma ve projeleri görür. Personelin kişisel bilgileri müşteri hesaplarına kapalıdır; değişiklikler kayıt altına alınır.",
  },
];

/** Özellik kartlarının simge renkleri (globals.css --tone-*); sırayla döner. */
const TONES = ["blue", "emerald", "violet", "amber", "teal", "rose"] as const;

const steps = [
  { title: "Tanışma ve kurulum", text: "İhtiyaçlarınızı dinleriz; firmanız, projeleriniz ve hizmet alanlarınız sisteme tanımlanır." },
  { title: "Personel ve evraklar", text: "Personel kartları ve özlük evrakları işlenir; mevcut listeler Excel ile toplu aktarılabilir." },
  { title: "Günlük operasyon", text: "Yönetim merkezi puantaj, izin, bordro, denetim ve devriye süreçlerini sistem üzerinden yürütür." },
  { title: "Anlık takip", text: "Size tanımlanan hesapla giriş yapar, projelerinizi, belgelerinizi ve cari hesabınızı panelden izlersiniz." },
];

/** Ürün hakkında gerçek sorular; cevaplar portalın bugünkü işleyişini anlatır. FAQPage JSON-LD de buradan. */
const faq = [
  {
    q: `${BRAND} nedir, kimler için uygundur?`,
    a: `${BRAND}; sitelerin, iş merkezlerinin, hastanelerin ve firmaların güvenlik, temizlik, danışma ve tesis yönetimi personeli süreçlerini tek panelde toplayan bir operasyon yönetim platformudur. Personel, evrak, puantaj, izin, bordro, fatura ve devriye bilgileri tek yerde tutulur.`,
  },
  {
    q: "Hesabımı nasıl açarım? Kendim kayıt olabilir miyim?",
    a: "Kendi kendine kayıt yoktur. Hesaplar yönetim merkezi tarafından açılır ve kullanıcı adı ile parola size iletilir. Parolanızı unutursanız merkez sıfırlar.",
  },
  {
    q: "Müşteri olarak hangi bilgileri görebilirim?",
    a: "Yalnızca kendi firmanızın, size erişim verilen projelerine ait bilgileri görürsünüz. Hangi ekranları göreceğiniz hesabınıza tanımlanan role bağlıdır. Personelin TC kimlik numarası, IBAN, adres ve telefon gibi kişisel bilgileri müşteri hesaplarına açılmaz.",
  },
  {
    q: "QR devriye sistemi için ek cihaz ya da uygulama gerekir mi?",
    a: "Hayır. Devriye noktalarına QR etiketleri asılır; görevli etiketleri kendi telefonunun kamerasıyla okutur. Tur, “Devriye başlat / bitir” etiketiyle ve proje PIN’iyle başlatılır. Atlanan noktalar ve günlük devriye raporu PDF olarak alınabilir.",
  },
  {
    q: "Mobil cihazlardan kullanılabilir mi?",
    a: "Evet. Platform tarayıcı üzerinden çalışır; bilgisayar, tablet ve telefondan kurulum gerektirmeden kullanılabilir.",
  },
  {
    q: "Yıllık izin hakları nasıl hesaplanır?",
    a: "Yasal yıllık izin hakkı personelin işe giriş ve doğum tarihinden hesaplanır. Yıllık izinde hafta tatili ve resmi tatiller izin gününden sayılmaz; sistem önerir, gerekirse yönetici düzeltir. Mazeret ve raporlu izinler yıllık izin bakiyesinden düşmez.",
  },
  {
    q: "Verilerimiz nasıl korunuyor?",
    a: "Bağlantılar şifrelidir (HTTPS). Erişim kuralları veritabanı düzeyinde uygulanır: her hesap yalnızca yetkili olduğu kayıtları görebilir. Yapılan değişiklikler işlem geçmişine kaydedilir. Ayrıntılar Gizlilik Politikası ve KVKK Aydınlatma Metni’ndedir.",
  },
  {
    q: "Teklif veya demo nasıl alabilirim?",
    a: "İletişim sayfasındaki formu “Teklif” ya da “Demo talebi” konusuyla doldurmanız yeterli; size en kısa sürede dönüş yapılır.",
  },
];

/**
 * Ana sayfa. Eski ana sayfanın öğeleri KORUNUR (sahibin isteği): sol üstte büyük logo + alt başlık, sağ üstte büyük
 * "Giriş Yap / Panele git" düğmesi ve altında sarı çizgili italik slogan, hero-glow zemin, hero cümlesi + sarı alan adı
 * hapı, "Hizmet alanlarımız" renkli kartları, 7 simgeli şerit; en altta lacivert slogan şeridi (alt bilgide).
 * 14 Kasım 2026 tasarım yenilemesi: büyük hero başlığı + panel çizimi (PanelPreview), kartlarda hover, renkli özellik
 * simgeleri, adım çizgisi, SSS kartları, desenli iletişim çağrısı.
 */
export default async function Home() {
  const lines = await getPublicServiceLines();

  return (
    <div className="hero-glow flex-1">
      <JsonLd json={ldJson(organizationLd(), websiteLd(), faqLd(faq))} />

      {/* ---------------- Eski üst kısım: büyük logo + alt başlık | menü + büyük Giriş Yap + slogan ---------------- */}
      <header className="relative mx-auto flex w-full max-w-6xl items-start justify-between gap-3 px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          {/* telefonda orta boy logo (düğme ve menü aynı satıra sığsın), geniş ekranda büyük */}
          <span className="sm:hidden"><Logo gradientId="lm-ring-hm" /></span>
          <span className="hidden sm:block"><Logo size="lg" gradientId="lm-ring-hd" /></span>
          <p className="mt-1 pl-1 text-xs font-medium text-navy/80 sm:text-base">{BRAND_TAGLINE}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="flex items-center gap-1.5 md:gap-4">
            <DesktopNav lg />
            <AuthButton className="sm:h-12 sm:px-8 sm:text-base" />
            <MobileNav lg />
          </div>
          <p className="hidden max-w-xs text-right text-2xl font-semibold italic leading-snug text-navy md:block">
            {BRAND_SLOGAN}
            <span aria-hidden className="mt-1 block h-1 w-48 -rotate-2 rounded-full bg-accent md:ml-auto" />
          </p>
        </div>
      </header>

      <main id="icerik" tabIndex={-1} className="focus:outline-none">
        {/* ---------------- Hero: başlık + panel çizimi ---------------- */}
        <section aria-labelledby="baslik" className="relative">
          <div aria-hidden className="site-grid pointer-events-none absolute inset-0" />
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="site-blob absolute -left-20 top-10 size-72 rounded-full bg-brand/15" />
            <span className="site-blob-2 absolute right-0 top-40 size-80 rounded-full bg-accent/20" />
          </div>
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-20">
            <div className="site-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-surface/80 px-3.5 py-1.5 text-xs font-semibold text-brand-hover shadow-sm backdrop-blur sm:text-sm">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-brand" />
                </span>
                Tek panelde personel operasyonu
              </p>
              <h1 id="baslik" className="mt-5 text-[1.85rem] font-bold leading-[1.18] tracking-tight text-navy sm:text-4xl lg:text-[2.7rem]">
                Site ve Firmaların <span className="site-mark">Personel Tedarik</span>, Operasyonel Yönetim, Personel Lojistiği ve{" "}
                <span className="text-brand-hover">Yasal Süreçlerin</span> Takibi.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-fg/80 sm:text-lg">
                Özlük evrakından puantaja, izinden bordroya, QR devriyeden cari hesaba kadar bütün süreçler tek yerde. Müşteriniz
                kendi projelerini panelinden anlık izler.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/iletisim?konu=demo"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-white shadow-[0_8px_20px_-6px_color-mix(in_oklab,var(--brand)_70%,transparent)] transition hover:-translate-y-0.5 hover:bg-brand-hover"
                >
                  Teklif veya demo isteyin <ArrowRight className="size-5" aria-hidden />
                </Link>
                <span className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-accent px-5 text-base font-bold text-accent-fg shadow-card">
                  <Globe className="size-5" aria-hidden /> {BRAND_DOMAIN}
                </span>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-fg/80">
                {["Tarayıcıdan, kurulumsuz", "Rol bazlı yetki", "Uygulamasız QR devriye"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <BadgeCheck className="size-4 text-success" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="site-rise-3 hidden md:block md:px-8 lg:px-0">
              <PanelPreview />
            </div>
          </div>
        </section>

        {/* ---------------- Hizmet alanları (renkli kartlar) ---------------- */}
        <section aria-labelledby="hizmetler" className="relative mx-auto w-full max-w-6xl px-6 pb-14">
          <div className="site-reveal flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-hover">Hizmet alanlarımız</p>
              <h2 id="hizmetler" className="mt-1 scroll-mt-24 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Her hizmet hattı kendi düzeninde</h2>
            </div>
            <p className="max-w-sm text-sm text-fg/75">Projeler hizmet alanına göre ayrılır; personel, evrak ve raporlar o alanın altında toplanır.</p>
          </div>
          <ul className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
            {lines.map((line) => (
              <li
                key={line.code}
                id={`hizmet-${line.code}`}
                className="site-reveal site-lift group relative flex min-h-44 scroll-mt-24 flex-col justify-between overflow-hidden rounded-2xl p-6 text-white shadow-card"
                style={{ background: `linear-gradient(140deg, ${lineColor(line.code)}, color-mix(in oklab, ${lineColor(line.code)} 70%, black))` }}
              >
                <span className="grid size-12 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <LineIcon name={line.icon} className="size-7" />
                </span>
                <div className="relative">
                  <h3 className="text-lg font-semibold leading-snug">{lineTitle(line.name)}</h3>
                  {line.description && <p className="mt-1 text-sm leading-snug text-white/90">{line.description}</p>}
                </div>
                <span aria-hidden className="pointer-events-none absolute -bottom-12 -right-10 size-36 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-125" />
                <span aria-hidden className="pointer-events-none absolute -right-4 -top-8 size-20 rounded-full bg-white/5" />
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------- 7 simgeli şerit ---------------- */}
        <section aria-label="Hizmet kapsamımız" className="border-y border-border bg-surface">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-7 px-6 py-9 sm:grid-cols-4 lg:grid-cols-7">
            {strip.map(({ icon: Icon, label }) => (
              <li key={label} className="site-reveal group flex flex-col items-center gap-2.5 text-center text-sm font-medium text-navy">
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <Icon className="size-7" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* ================= Yeni bölümler (eski içeriğin altında) ================= */}

        {/* ---------------- Özellikler ---------------- */}
        <section id="ozellikler" aria-labelledby="ozellikler-baslik" className="scroll-mt-6 bg-bg">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <div className="site-reveal mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-hover">Özellikler</p>
              <h2 id="ozellikler-baslik" className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Operasyonun her adımı tek panelde</h2>
              <p className="mt-3 text-fg/80">
                Yönetim merkezi işi yürütür; müşteri kendi projelerini, belgelerini ve cari hesabını aynı yerden izler.
              </p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }, i) => {
                const tone = TONES[i % TONES.length];
                return (
                  <li key={title} className="site-reveal site-lift group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card hover:border-transparent">
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                      style={{ background: `var(--tone-${tone})` }}
                    />
                    <span
                      className="grid size-12 place-items-center rounded-xl"
                      style={{ background: `var(--tone-${tone}-soft)`, color: `var(--tone-${tone})` }}
                      aria-hidden
                    >
                      <Icon className="size-6" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-navy">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-fg/80">{text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---------------- QR devriye (çizimli) ---------------- */}
        <PatrolShowcase />

        {/* ---------------- Nasıl çalışır ---------------- */}
        <section id="nasil-calisir" aria-labelledby="nasil-baslik" className="scroll-mt-6 bg-bg">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <p className="site-reveal text-sm font-semibold uppercase tracking-wider text-brand-hover">Nasıl çalışır?</p>
            <h2 id="nasil-baslik" className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Dört adımda başlayın</h2>
            <ol className="relative mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* adımları birleştiren kesikli çizgi (geniş ekran) */}
              <span aria-hidden className="pointer-events-none absolute left-[12%] right-[12%] top-11 hidden border-t-2 border-dashed border-brand/25 lg:block" />
              {steps.map((s, i) => (
                <li key={s.title} className="site-reveal site-lift relative rounded-2xl border border-border bg-surface p-6 shadow-card">
                  <span
                    className="relative grid size-11 place-items-center rounded-full bg-navy text-base font-bold text-white ring-4 ring-surface"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-navy"><span className="sr-only">{i + 1}. adım: </span>{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg/80">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------- SSS ---------------- */}
        <section id="sss" aria-labelledby="sss-baslik" className="scroll-mt-6 bg-bg">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_2fr] lg:py-20">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-hover">SSS</p>
              <h2 id="sss-baslik" className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Sık sorulan sorular</h2>
              <p className="mt-3 text-fg/80">
                Aradığınız cevabı bulamadıysanız{" "}
                <Link href="/iletisim" className="font-medium text-brand-hover underline underline-offset-2 hover:text-navy">iletişim formundan</Link>{" "}
                bize yazın.
              </p>
            </div>
            <div className="space-y-3">
              {faq.map((f) => (
                <details
                  key={f.q}
                  className="site-reveal group rounded-2xl border border-border bg-surface px-5 shadow-sm transition-shadow open:shadow-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-navy [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-hover transition-colors group-open:bg-brand group-open:text-white">
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                    </span>
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-fg/80">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- İletişim çağrısı ---------------- */}
        <section aria-labelledby="cta-baslik" className="bg-bg">
          <div className="mx-auto max-w-6xl px-6 pb-16 lg:pb-20">
            <div className="site-reveal site-navy relative overflow-hidden rounded-3xl px-6 py-12 text-white shadow-card sm:px-12 sm:py-14">
              <div aria-hidden className="site-grid-dark pointer-events-none absolute inset-0" />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 id="cta-baslik" className="text-2xl font-bold tracking-tight sm:text-3xl">Teklif veya demo için bize yazın</h2>
                  <p className="mt-2 max-w-xl text-white/80">
                    Projelerinizi ve ihtiyaçlarınızı kısaca anlatın; {BRAND} ekibi size en kısa sürede dönüş yapsın.
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
                    {["Kurulum desteği", "Excel ile toplu aktarım", "Tarayıcıdan, kurulumsuz"].map((t) => (
                      <li key={t} className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-accent" aria-hidden /> {t}</li>
                    ))}
                  </ul>
                </div>
                <Link href="/iletisim" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-semibold text-accent-fg hover:brightness-105">
                  İletişim formuna gidin <ArrowRight className="size-5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
