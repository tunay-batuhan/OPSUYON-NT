import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/components/ui";
import { COMPANY, COMPANY_COMPLETE, has, isPlaceholder } from "@/lib/site";
import { breadcrumbLd, ldJson } from "@/lib/seo";

/**
 * Şirket bilgisi: doldurulmamışsa (src/lib/site.ts'de "[...]") sarı işaretli yer tutucu olarak görünür ve
 * bağlantıya dönüşmez; doldurulmuşsa düz metin ya da `href` verilirse bağlantı.
 */
export function Fact({ value, href, className }: { value: string; href?: string; className?: string }) {
  if (isPlaceholder(value)) {
    return (
      <mark className={cn("rounded bg-accent px-1 font-medium text-accent-fg", className)} title="Henüz doldurulmadı: src/lib/site.ts">
        {value || "[Doldurulacak]"}
      </mark>
    );
  }
  return href ? (
    <a href={href} className={className ?? "font-medium text-brand underline underline-offset-2 hover:text-brand-hover"}>{value}</a>
  ) : (
    <span className={className}>{value}</span>
  );
}

/** Açık adres; her parça ayrı denetlenir (kısmen doldurulmuş adreste de eksik parça işaretli görünür). */
export function CompanyAddress({ className }: { className?: string }) {
  const a = COMPANY.address;
  return (
    <span className={className}>
      <Fact value={a.street} />, {has(a.postalCode) && <>{a.postalCode} </>}<Fact value={a.district} />/<Fact value={a.city} />
    </span>
  );
}

/** "2026-11-12" → "12 Kasım 2026" (saat dilimi kaydırmasın diye UTC). */
export const longDate = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function JsonLd({ json }: { json: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** İç sayfaların üst bandı: görünür "Konum" izi (+ BreadcrumbList JSON-LD), tek h1, kısa giriş. */
export function PageHero({ title, path, lead, children }: { title: string; path: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="hero-glow relative overflow-hidden border-b border-border">
      <JsonLd json={ldJson(breadcrumbLd([{ name: title, path }]))} />
      <div aria-hidden className="site-grid pointer-events-none absolute inset-0" />
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand/10 blur-2xl" />
      <div className="site-rise relative mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
        <nav aria-label="Konum" className="text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/" className="hover:text-fg hover:underline">Ana sayfa</Link></li>
            <li aria-hidden><ChevronRight className="size-4" /></li>
            <li aria-current="page" className="font-medium text-fg">{title}</li>
          </ol>
        </nav>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-[2.6rem] sm:leading-tight">{title}</h1>
        <span aria-hidden className="mt-3 block h-1 w-16 rounded-full bg-accent" />
        {lead && <p className="mt-4 max-w-3xl text-base leading-relaxed text-fg/75 sm:text-lg">{lead}</p>}
        {children}
      </div>
    </div>
  );
}

/** Yasal metin kabuğu: başlık, son güncelleme tarihi, (şirket bilgileri eksikken) taslak notu ve metin. */
export function LegalPage({ title, path, updated, lead, children }: { title: string; path: string; updated: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHero title={title} path={path} lead={lead}>
        <p className="mt-4 text-sm text-muted">
          Son güncelleme: <time dateTime={updated} className="font-medium text-fg">{longDate(updated)}</time>
        </p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {!COMPANY_COMPLETE && (
          <p className="mb-8 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Şirket bilgileri henüz tamamlanmadı; işaretli alanlar doldurulduğunda bu metin güncellenecektir.</span>
          </p>
        )}
        <div className="legal-prose">{children}</div>
      </div>
    </>
  );
}
