import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    default: "OPSUYON — Operasyonel Personel Süreç Yönetimi",
    template: "%s · OPSUYON",
  },
  description:
    "Güvenlik, temizlik ve kurumsal tedarik hizmetlerinde personel, puantaj, bordro, fatura ve cari hesap takibi.",
  metadataBase: new URL("https://opsuyon.com"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
