import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";
import { SITE_INDEXABLE, SITE_URL } from "@/lib/site";
import { NavProgress } from "@/components/nav-progress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND} — ${BRAND_TAGLINE}`,
    template: `%s · ${BRAND}`,
  },
  description:
    "Güvenlik, temizlik ve kurumsal tedarik hizmetlerinde personel, puantaj, bordro, fatura ve cari hesap takibi.",
  applicationName: BRAND,
  metadataBase: new URL(SITE_URL),
  // Arama motoru anahtarı (src/lib/site.ts): kapalıyken her sayfa noindex. Açıkken de giriş arkasındaki
  // ekranlar, /giris ve devriye sayfaları kendi düzenlerinde noindex kalır.
  robots: SITE_INDEXABLE ? undefined : { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <NavProgress>{children}</NavProgress>
      </body>
    </html>
  );
}
