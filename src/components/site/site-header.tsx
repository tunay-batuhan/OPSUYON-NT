import { Logo } from "@/components/logo";
import { AuthButton } from "@/components/site/auth-button";
import { DesktopNav, MobileNav } from "@/components/site/site-nav";

/**
 * İç sayfaların kompakt üst çubuğu: logo (giriş sayfasıyla aynı boyut), menü, Giriş Yap.
 * Ana sayfanın üst kısmı ayrıdır (HomeHeader: eski büyük logo + büyük Giriş Yap düzeni).
 * `auth={false}`: giriş sayfasında "Giriş Yap" düğmesi gösterilmez (zaten o sayfadayız).
 */
export function SiteHeader({ auth = true }: { auth?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="relative mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo className="shrink-0" />
        <DesktopNav />
        <div className="flex items-center gap-1.5">
          {auth ? <AuthButton className="h-10 px-4" /> : <span aria-hidden className="hidden w-[7.5rem] md:block" />}
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
