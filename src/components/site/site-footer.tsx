import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { CompanyAddress, Fact } from "@/components/site/parts";
import { LEGAL_NAV } from "@/components/site/nav-items";
import { BRAND, BRAND_FOOTER, BRAND_TAGLINE } from "@/lib/brand";
import { COMPANY, activeSocial, mailHref, telHref } from "@/lib/site";
import { FALLBACK_SERVICE_LINES, lineTitle } from "@/lib/lines";

const linkCls = "text-white/80 underline-offset-2 hover:text-white hover:underline";

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

/**
 * Lacivert alt bilgi: üstte eski ana sayfadaki slogan şeridi (BRAND_FOOTER), altında çok sütunlu bilgiler. Hizmet bağlantıları ana sayfadaki kartlara iner (#hizmet-<kod>); liste statik
 * tutulur ki alt bilgi her sayfayı veritabanına bağlamasın. Yıl, sayfa üretildiği (yayın) anda yazılır.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const social = activeSocial();
  return (
    <footer className="bg-navy text-white">
      {/* Eski ana sayfanın lacivert slogan şeridi: tüm sayfalarda alt bilginin başında */}
      <div className="border-b border-white/15 px-4 py-5 text-center">
        <p className="text-lg italic text-white sm:text-xl">{BRAND_FOOTER}</p>
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-14">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo dark size="md" />
          <p className="mt-3 font-medium text-white">{BRAND_TAGLINE}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/75">
            Güvenlik, temizlik, danışma ve tesis yönetimi hizmetlerinde personel, özlük evrakı, puantaj, izin, bordro, fatura ve
            devriye süreçlerini tek panelde yöneten {BRAND} platformu.
          </p>
          {social.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Sosyal medya hesaplarımız">
              {social.map((s) => (
                <li key={s.label}><a href={s.url} className={linkCls} rel="noopener noreferrer" target="_blank">{s.label}</a></li>
              ))}
            </ul>
          )}
        </div>

        <Column title="Hizmetler">
          {FALLBACK_SERVICE_LINES.map((l) => (
            <li key={l.code}><Link href={`/#hizmet-${l.code}`} className={linkCls}>{lineTitle(l.name)}</Link></li>
          ))}
        </Column>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-1">
          <Column title="Kurumsal">
            <li><Link href="/hakkimizda" className={linkCls}>Hakkımızda</Link></li>
            <li><Link href="/iletisim" className={linkCls}>İletişim</Link></li>
            <li><Link href="/#sss" className={linkCls}>Sık sorulan sorular</Link></li>
            <li><Link href="/giris" className={linkCls}>Müşteri ve merkez girişi</Link></li>
          </Column>
          <Column title="Yasal">
            {LEGAL_NAV.map((l) => (
              <li key={l.href}><Link href={l.href} className={linkCls}>{l.label}</Link></li>
            ))}
          </Column>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">İletişim</h2>
          <address className="mt-4 space-y-3 text-sm not-italic text-white/80">
            <p className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span><span className="sr-only">Adres: </span><CompanyAddress /></span>
            </p>
            <p className="flex gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span><span className="sr-only">Telefon: </span><Fact value={COMPANY.phone} href={telHref()} className="text-white/90 underline-offset-2 hover:text-white hover:underline" /></span>
            </p>
            <p className="flex gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 [overflow-wrap:anywhere]"><span className="sr-only">E-posta: </span><Fact value={COMPANY.email} href={mailHref()} className="text-white/90 underline-offset-2 hover:text-white hover:underline" /></span>
            </p>
            <p className="flex gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span><span className="sr-only">Çalışma saatleri: </span><Fact value={COMPANY.workingHours} /></span>
            </p>
          </address>
          <Link href="/iletisim" className="mt-5 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg hover:brightness-105">
            İletişim formu
          </Link>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="text-white/75">
            © {year} <Fact value={COMPANY.legalName} />. Tüm hakları saklıdır.
          </p>
          <p className="text-white/60">{BRAND} · {BRAND_TAGLINE}</p>
        </div>
      </div>
    </footer>
  );
}
