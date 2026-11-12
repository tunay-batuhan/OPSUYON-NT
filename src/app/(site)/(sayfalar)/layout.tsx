import { SiteHeader } from "@/components/site/site-header";

/** İç sayfalar (Hakkımızda, İletişim, yasal metinler): kompakt üst çubuk + içerik. */
export default function InnerPagesLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="icerik" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
    </>
  );
}
