import Link from "next/link";
import {
  ArrowRight, CalendarDays, FileText, FolderOpen, Globe, LogIn, Settings, ShieldCheck, Truck, UserRound,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { btn, lineColor, LineIcon } from "@/components/ui";
import { getServiceLines } from "@/lib/lines";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { BRAND_DOMAIN, BRAND_FOOTER, BRAND_SLOGAN, BRAND_TAGLINE } from "@/lib/brand";

const strip = [
  { icon: UserRound, label: "Personel Tedariki" },
  { icon: Settings, label: "Operasyonel Yönetim" },
  { icon: Truck, label: "Personel Lojistiği" },
  { icon: FileText, label: "Özlük Evrakları ve Sözleşmeler" },
  { icon: CalendarDays, label: "Puantaj ve İzin Takibi" },
  { icon: FolderOpen, label: "Fatura ve Cari Hesap" },
  { icon: ShieldCheck, label: "Yasal Süreç Takibi" },
];

export default async function Home() {
  const [lines, user] = await Promise.all([getServiceLines(), getCurrentUser().catch(() => null)]);

  return (
    <div className="hero-glow flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div>
          <Logo size="lg" />
          <p className="mt-1 pl-1 text-sm font-medium text-navy/80 sm:text-base">{BRAND_TAGLINE}</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <Link href={user ? homePathFor(user) : "/giris"} className={btn("primary", "lg", "px-8 text-base shadow-card")}>
            {user ? (
              <>Panele git <ArrowRight className="size-5" aria-hidden /></>
            ) : (
              <><LogIn className="size-5" aria-hidden /> Giriş Yap</>
            )}
          </Link>
          <p className="hidden max-w-xs text-right text-2xl font-semibold italic leading-snug text-navy md:block">
            {BRAND_SLOGAN}
            <span aria-hidden className="mt-1 block h-1 w-48 -rotate-2 rounded-full bg-accent md:ml-auto" />
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-14">
        <section>
          <p className="max-w-xl text-xl font-medium leading-snug text-navy sm:text-2xl">
            Site ve Firmaların Personel Tedarik, Operasyonel Yönetim, Personel Lojistiği ve Yasal Süreçlerin Takibi.
          </p>
          <span className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-accent px-5 py-2.5 text-lg font-bold text-accent-fg shadow-card">
            <Globe className="size-5" aria-hidden /> {BRAND_DOMAIN}
          </span>

          <p className="mb-3 mt-12 text-sm font-semibold uppercase tracking-wider text-muted">Hizmet alanlarımız</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lines.map((line) => (
              <div
                key={line.code}
                className="relative flex min-h-40 flex-col justify-between overflow-hidden rounded-2xl p-6 text-white shadow-card"
                style={{ background: `linear-gradient(135deg, ${lineColor(line.code)}, color-mix(in oklab, ${lineColor(line.code)} 76%, black))` }}
              >
                <LineIcon name={line.icon} className="size-10" />
                <div>
                  <h2 className="text-lg font-semibold">{line.name} Yönetimi</h2>
                  <p className="mt-1 text-sm text-white/85">{line.description}</p>
                </div>
                <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 size-32 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </section>
      </main>

      <section aria-label="Özellikler" className="border-t border-border bg-surface">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-6 px-6 py-7 sm:grid-cols-4 lg:grid-cols-7">
          {strip.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-center gap-2 text-center text-sm font-medium text-navy">
              <Icon className="size-8 text-brand" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </section>
      <footer className="bg-navy py-5 text-center">
        <p className="text-lg italic text-white sm:text-xl">{BRAND_FOOTER}</p>
      </footer>
    </div>
  );
}
