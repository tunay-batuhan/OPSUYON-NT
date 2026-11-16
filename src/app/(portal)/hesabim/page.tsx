import type { Metadata } from "next";
import { KeyRound, LogOut } from "lucide-react";
import { PersonnelPasswordForm } from "@/components/forms/personnel-password-form";
import { logoutAction } from "@/app/actions/auth";
import { requirePersonnel } from "@/lib/auth";
import { str1 } from "@/lib/lookups";

export const metadata: Metadata = { title: "Hesabım" };

/** Personel: parola değiştirme (ilk girişte zorunlu), hesap bilgisi, çıkış. */
export default async function MyAccountPage({ searchParams }: PageProps<"/hesabim">) {
  const me = await requirePersonnel({ passwordPage: true });
  const first = me.must_change_password || Boolean(str1((await searchParams).ilk));

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{me.must_change_password ? "Parolanızı belirleyin" : "Hesabım"}</h1>
      {me.must_change_password ? (
        <p className="mt-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-hover">
          Hoş geldiniz {me.full_name.split(" ")[0]}. Size verilen parola geçicidir; devam etmek için kendi parolanızı belirleyin.
        </p>
      ) : (
        <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">Ad soyad</dt>
            <dd className="font-medium">{me.full_name}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">Kullanıcı adı</dt>
            <dd className="font-mono font-medium">{me.username}</dd>
          </div>
        </dl>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-5 text-brand" aria-hidden /> {first ? "Yeni parola" : "Parolayı değiştir"}
        </h2>
        <PersonnelPasswordForm first={me.must_change_password} />
      </section>

      <form action={logoutAction} className="mt-6">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-base font-medium text-danger">
          <LogOut className="size-5" aria-hidden /> Çıkış yap
        </button>
      </form>
    </>
  );
}
