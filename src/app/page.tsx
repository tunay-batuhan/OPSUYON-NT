import Link from "next/link";
import { ArrowRight, Building2, FileText, Users, CalendarCheck, Wallet, MessageSquare, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { btn, lineColor, LineIcon } from "@/components/ui";
import { getServiceLines } from "@/lib/lines";
import { getCurrentUser, homePathFor } from "@/lib/auth";

const features = [
  { icon: Users, title: "Personel & özlük", text: "Projenize atanan personelin özlük evrakları ve sözleşmeleri tek yerde." },
  { icon: CalendarCheck, title: "Puantaj & izin", text: "Aylık puantajlar ve yıllık izin durumları güncel ve indirilebilir." },
  { icon: FileText, title: "Bordro", text: "Personel bordrolarına yetkiniz ölçüsünde güvenle ulaşın." },
  { icon: Wallet, title: "Fatura & cari hesap", text: "Kesilen faturalar, ödemeler ve anlık cari bakiye." },
  { icon: MessageSquare, title: "Merkez ile yazışma", text: "Sorularınızı doğrudan operasyon merkezine iletin." },
  { icon: Lock, title: "Yetki bazlı erişim", text: "Her kullanıcı yalnızca merkezin yetkilendirdiği bilgileri görür." },
];

export default async function Home() {
  const [lines, user] = await Promise.all([getServiceLines(), getCurrentUser().catch(() => null)]);

  return (
    <div className="hero-glow flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        {user ? (
          <Link href={homePathFor(user)} className={btn("primary", "lg")}>
            Panele git <ArrowRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <Link
            href="/giris/merkez"
            className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:border-brand sm:px-5 sm:py-3"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--side-bg)] text-teal-300" aria-hidden>
              <Building2 className="size-5" />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-base font-semibold sm:text-lg">Merkez girişi</span>
              <span className="hidden text-xs text-muted sm:block">Yönetim paneli</span>
            </span>
            <ArrowRight className="size-5 text-brand transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        <section className="py-14 sm:py-20">
          <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            Operasyonel Personel Süreç Yönetimi
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Personel, puantaj ve faturalarınız <span className="text-brand">tek panelde.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Hizmet aldığınız alanı seçerek size tanımlanan kullanıcı adı ve parola ile giriş yapın.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((line) => {
              return (
                <Link
                  key={line.code}
                  href={`/giris/${line.code}`}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card transition hover:-translate-y-0.5 hover:border-[color:var(--c)]"
                  style={{ ["--c" as string]: lineColor(line.code) }}
                >
                  <span
                    className="grid size-12 place-items-center rounded-xl text-white"
                    style={{ background: lineColor(line.code) }}
                    aria-hidden
                  >
                    <LineIcon name={line.icon} className="size-6" />
                  </span>
                  <h2 className="mt-5 text-xl font-semibold">{line.name}</h2>
                  <p className="mt-1 text-sm text-muted">{line.description}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: lineColor(line.code) }}>
                    Giriş yap
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="pb-20">
          <h2 className="mb-6 text-sm font-medium uppercase tracking-wide text-muted">Panelde neler var?</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border bg-surface/70 p-5">
                <Icon className="size-5 text-brand" aria-hidden />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5 text-sm text-muted">
          <span>© {new Date().getFullYear()} OPSUYON · opsuyon.com</span>
          <span>Hesap bilgileriniz merkez tarafından tanımlanır.</span>
        </div>
      </footer>
    </div>
  );
}
