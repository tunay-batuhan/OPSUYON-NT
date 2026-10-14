import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/forms/auth-forms";
import { getCurrentUser, homePathFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(homePathFor(user));

  return (
    <div className="hero-glow flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Ana sayfa
        </Link>
      </header>

      <main className="grid flex-1 place-items-center px-6 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-card">
          <span className="grid size-12 place-items-center rounded-xl bg-navy text-white" aria-hidden>
            <LockKeyhole className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Giriş</h1>
          <p className="mt-1 text-sm text-muted">Size tanımlanan kullanıcı adı ve parola ile giriş yapın. Hesabınıza tanımlı ekranlar otomatik açılır.</p>
          <LoginForm />
          <p className="mt-6 text-center text-xs text-muted">Parolanızı unuttuysanız merkez ile iletişime geçin.</p>
        </div>
      </main>
    </div>
  );
}
