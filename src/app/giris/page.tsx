import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, FolderOpen, LockKeyhole, QrCode, ShieldCheck, Users } from "lucide-react";
import { LoginForm } from "@/components/forms/auth-forms";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { BRAND, BRAND_SLOGAN } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Giriş",
  description: `${BRAND} müşteri ve merkez paneline giriş: projeler, personel, puantaj, bordro, cari hesap ve QR devriye raporları.`,
  alternates: { canonical: "/giris" },
};

const inside = [
  { icon: Users, title: "Projeler ve personel", text: "Size açık projeler, personel listesi ve evraklar" },
  { icon: CalendarCheck, title: "Puantaj, izin ve bordro", text: "Aylık puantaj dosyaları, izinler ve bordrolar" },
  { icon: FolderOpen, title: "Fatura ve cari hesap", text: "Faturalar, tahsilatlar, güncel bakiye ve ekstre" },
  { icon: QrCode, title: "QR devriye raporları", text: "Tur kayıtları, atlanan noktalar, PDF rapor" },
];

/**
 * Giriş: sitenin üst çubuğu ve alt bilgisiyle (diğer sayfalarla aynı çerçeve). Solda panelde neler olduğu (lacivert kart),
 * sağda giriş formu; dar ekranda form önce gelir. Oturum açıksa doğrudan panele yönlenir.
 */
export default async function LoginPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(homePathFor(user));

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a
        href="#icerik"
        className="sr-only z-50 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        İçeriğe geç
      </a>
      <SiteHeader auth={false} />

      <main id="icerik" tabIndex={-1} className="hero-glow relative flex-1 focus:outline-none">
        <div aria-hidden className="site-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-stretch gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_27rem] lg:gap-8 lg:py-16">
          {/* ---- form ---- */}
          <section aria-labelledby="giris-baslik" className="site-rise lg:order-2">
            <div className="h-full rounded-3xl border border-border bg-surface p-7 shadow-[0_2px_4px_rgb(12_31_69/0.05),0_24px_48px_-16px_rgb(12_31_69/0.22)] sm:p-9">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-hover" aria-hidden>
                <LockKeyhole className="size-6" />
              </span>
              <h1 id="giris-baslik" className="mt-5 text-2xl font-bold tracking-tight text-navy sm:text-[1.7rem]">Panele giriş</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Size tanımlanan kullanıcı adı ve parola ile giriş yapın. Hesabınıza tanımlı ekranlar otomatik açılır.
              </p>
              <LoginForm />
              <div className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg/80">
                Parolanızı mı unuttunuz?{" "}
                <Link href="/iletisim?konu=destek" className="font-medium text-brand-hover underline underline-offset-2 hover:text-navy">
                  Merkeze yazın
                </Link>
                , parolanız sıfırlansın.
              </div>
              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
                <ShieldCheck className="size-4 text-success" aria-hidden /> Bağlantınız şifreli (HTTPS)
              </p>
            </div>
          </section>

          {/* ---- panelde neler var ---- */}
          <section aria-labelledby="panel-baslik" className="site-rise-2 lg:order-1">
            <div className="site-navy relative flex h-full flex-col overflow-hidden rounded-3xl p-7 text-white shadow-card sm:p-10">
              <div aria-hidden className="site-grid-dark pointer-events-none absolute inset-0" />
              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-wider text-accent">Müşteri ve merkez paneli</p>
                <h2 id="panel-baslik" className="mt-3 max-w-md text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  Operasyonunuz tek ekranda, her an yanınızda
                </h2>
                <p className="mt-3 max-w-md text-white/80">
                  Bilgisayar, tablet ya da telefondan; kurulum gerekmeden. Yalnızca hesabınıza açık olan bilgileri görürsünüz.
                </p>
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {inside.map(({ icon: Icon, title, text }) => (
                    <li key={title} className="flex gap-3 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-accent" aria-hidden>
                        <Icon className="size-5" />
                      </span>
                      <span>
                        <span className="block font-semibold">{title}</span>
                        <span className="mt-0.5 block text-sm text-white/75">{text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-auto flex flex-wrap items-center justify-between gap-4 pt-10">
                <p className="text-lg font-semibold italic text-white/90">{BRAND_SLOGAN}</p>
                <Link
                  href="/iletisim?konu=demo"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:brightness-105"
                >
                  Hesabınız yok mu? Demo isteyin <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
