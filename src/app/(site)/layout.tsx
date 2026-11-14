import { SiteFooter } from "@/components/site/site-footer";

/**
 * Herkese açık (girişsiz) sayfaların ortak çerçevesi: "İçeriğe geç" bağlantısı ve alt bilgi (lacivert slogan şeridi +
 * sütunlar). Üst çubuk ve <main id="icerik">: ana sayfada sayfanın kendisinde (eski büyük logo + büyük Giriş Yap
 * düzeni), iç sayfalarda (sayfalar)/layout.tsx'te (kompakt üst çubuk).
 * Düzen oturum okumaz: yasal sayfalar ve Hakkımızda tamamen statik, ana sayfa saatlik yenilenen statik (ISR),
 * iletişim sayfası (form güvenlik damgası için) istek anında üretilir.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="site-root flex min-h-screen flex-col bg-bg">
      <a
        href="#icerik"
        className="sr-only z-50 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        İçeriğe geç
      </a>
      {children}
      <SiteFooter />
    </div>
  );
}
