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
 * Ana sayfa. ÜST KISIM ESKİ ANA SAYFANIN AYNISIDIR (sahibin isteği): sol üstte büyük logo + alt başlık, sağ üstte büyük
 * "Giriş Yap / Panele git" düğmesi ve altında sarı çizgili italik slogan, hero-glow zemin, hero cümlesi + sarı alan adı
 * hapı, "Hizmet alanlarımız" renkli kartları, 7 simgeli şerit; en altta lacivert slogan şeridi (alt bilgide).
 * Eklenenler: üstte küçük menü bağlantıları, şeridin altına Özellikler · Nasıl çalışır · SSS · iletişim çağrısı.
 */
export default async function Home() {
  const lines = await getPublicServiceLines();

  return (
    <div className="hero-glow flex-1">
      <JsonLd json={ldJson(organizationLd(), websiteLd(), faqLd(faq))} />

      {/* ---------------- Eski üst kısım: büyük logo + alt başlık | menü + büyük Giriş Yap + slogan ---------------- */}
      <header className="relative mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div>
          <Logo size="lg" />
          <p className="mt-1 pl-1 text-sm font-medium text-navy/80 sm:text-base">{BRAND_TAGLINE}</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2 md:gap-4">
            <DesktopNav lg />
            <AuthButton size="lg" className="px-8 text-base" />
            <MobileNav lg />
          </div>
          <p className="hidden max-w-xs text-right text-2xl font-semibold italic leading-snug text-navy md:block">
            {BRAND_SLOGAN}
            <span aria-hidden className="mt-1 block h-1 w-48 -rotate-2 rounded-full bg-accent md:ml-auto" />
          </p>
        </div>
      </header>

      <main id="icerik" tabIndex={-1} className="focus:outline-none">
        {/* ---------------- Eski hero + hizmet kartları ---------------- */}
        <section aria-labelledby="baslik" className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
          <h1 id="baslik" className="max-w-xl text-xl font-medium leading-snug text-navy sm:text-2xl">
            Site ve Firmaların Personel Tedarik, Operasyonel Yönetim, Personel Lojistiği ve Yasal Süreçlerin Takibi.
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <span className="inline-flex items-center gap-2.5 rounded-full bg-accent px-5 py-2.5 text-lg font-bold text-accent-fg shadow-card">
              <Globe className="size-5" aria-hidden /> {BRAND_DOMAIN}
            </span>
            <Link href="/iletisim?konu=demo" className="inline-flex items-center gap-1.5 text-base font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline">
              Teklif veya demo isteyin <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <h2 id="hizmetler" className="mb-3 mt-12 scroll-mt-6 text-sm font-semibold uppercase tracking-wider text-muted">Hizmet alanlarımız</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((line) => (
              <li
                key={line.code}
                id={`hizmet-${line.code}`}
                className="relative flex min-h-40 scroll-mt-6 flex-col justify-between overflow-hidden rounded-2xl p-6 text-white shadow-card"
                style={{ background: `linear-gradient(135deg, ${lineColor(line.code)}, color-mix(in oklab, ${lineColor(line.code)} 76%, black))` }}
              >
                <LineIcon name={line.icon} className="size-10" />
                <div>
                  <h3 className="text-lg font-semibold">{lineTitle(line.name)}</h3>
                  {line.description && <p className="mt-1 text-sm text-white/90">{line.description}</p>}
                </div>
                <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 size-32 rounded-full bg-white/10" />
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------- Eski 7 simgeli şerit ---------------- */}
        <section aria-label="Hizmet kapsamımız" className="border-y border-border bg-surface">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-6 px-6 py-7 sm:grid-cols-4 lg:grid-cols-7">
            {strip.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-2 text-center text-sm font-medium text-navy">
                <Icon className="size-8 text-brand" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* ================= Yeni bölümler (eski içeriğin altında) ================= */}

        {/* ---------------- Özellikler ---------------- */}
        <section id="ozellikler" aria-labelledby="ozellikler-baslik" className="scroll-mt-6 bg-bg">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Özellikler</p>
            <h2 id="ozellikler-baslik" className="mt-2 text-3xl font-bold tracking-tight text-navy">Operasyonun her adımı tek panelde</h2>
            <p className="mt-3 max-w-2xl text-fg/75">
              Yönetim merkezi işi yürütür; müşteri kendi projelerini, belgelerini ve cari hesabını aynı yerden izler.
            </p>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-border bg-surface p-6 shadow-card">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-navy">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg/75">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------- Nasıl çalışır ---------------- */}
        <section id="nasil-calisir" aria-labelledby="nasil-baslik" className="scroll-mt-6 border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Nasıl çalışır?</p>
            <h2 id="nasil-baslik" className="mt-2 text-3xl font-bold tracking-tight text-navy">Dört adımda başlayın</h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-border bg-bg/60 p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-navy text-base font-bold text-white" aria-hidden>{i + 1}</span>
                  <h3 className="mt-4 font-semibold text-navy"><span className="sr-only">{i + 1}. adım: </span>{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg/75">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------- SSS ---------------- */}
        <section id="sss" aria-labelledby="sss-baslik" className="scroll-mt-6 bg-bg">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_2fr] lg:py-20">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand">SSS</p>
              <h2 id="sss-baslik" className="mt-2 text-3xl font-bold tracking-tight text-navy">Sık sorulan sorular</h2>
              <p className="mt-3 text-fg/75">
                Aradığınız cevabı bulamadıysanız{" "}
                <Link href="/iletisim" className="font-medium text-brand underline underline-offset-2 hover:text-brand-hover">iletişim formundan</Link>{" "}
                bize yazın.
              </p>
            </div>
            <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {faq.map((f) => (
                <details key={f.q} className="group px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-navy [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
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
            <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-12 text-white shadow-card sm:px-12">
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brand/30" />
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
