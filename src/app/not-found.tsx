import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <p className="text-5xl font-semibold tracking-tight text-brand">404</p>
        <h1 className="mt-3 text-xl font-semibold">Sayfa bulunamadı</h1>
        <p className="mt-1 text-sm text-muted">Aradığınız sayfa yok ya da bu hesapta kullanıma açık değil.</p>
        <Link href="/" className={btn("primary", "md", "mt-6")}>Ana sayfaya dön</Link>
      </div>
    </main>
  );
}
