import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { Card, CardHeader, Notice, PageHeader, btn, cn } from "@/components/ui";
import { Dashboard } from "@/components/dashboard";
import { canAnywhere, hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ana Sayfa" };

export default async function MerkezHome({ searchParams }: PageProps<"/merkez">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;

  const [orgs, projects, customers, personnel] = await Promise.all([
    supabase.from("organizations").select("id", head),
    supabase.from("projects").select("id", head),
    supabase.from("profiles").select("id", head).eq("kind", "customer"),
    supabase.from("personnel").select("id", head),
  ]);

  const steps = [
    { n: 1, title: "Firma ekle", text: "Hizmet verdiğiniz müşteri firmayı tanımlayın.", href: "/merkez/firmalar#yeni", done: (orgs.count ?? 0) > 0, perm: "organizations.manage" },
    { n: 2, title: "Proje oluştur", text: "Firmaya bağlı proje açın, hizmet alanını seçin.", href: "/merkez/projeler#yeni", done: (projects.count ?? 0) > 0, perm: "projects.manage" },
    { n: 3, title: "Müşteri hesabı aç", text: "Kullanıcı adı ve parola üretip müşteriye iletin.", href: "/merkez/kullanicilar#yeni", done: (customers.count ?? 0) > 0, perm: "users.manage" },
    { n: 4, title: "Personel ekle", text: "Personeli havuza ekleyip projelere atayın.", href: "/merkez/personel#yeni", done: (personnel.count ?? 0) > 0, perm: "personnel.manage" },
  ].filter((s) => hasPermission(user, s.perm));
  const allDone = steps.every((s) => s.done);

  return (
    <>
      <PageHeader title="Ana Sayfa" description="Operasyonun anlık özeti." />
      {sp.yetki === "yok" && (
        <div className="mb-6"><Notice tone="warning">Bu bölüme erişim yetkiniz bulunmuyor.</Notice></div>
      )}

      <Dashboard user={user} />

      {!allDone && steps.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Başlangıç adımları"
            description="Bir müşterinin sisteme girebilmesi için sırasıyla: firma → proje → hesap. Hesabı yalnızca merkez açar."
          />
          <ol className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n}>
                <Link
                  href={s.href}
                  className={cn(
                    "group flex h-full flex-col rounded-xl border p-4 transition hover:-translate-y-0.5",
                    s.done ? "border-success/40 bg-success-soft/50" : "border-border bg-surface-2/50 hover:border-brand",
                  )}
                >
                  <span className={cn("grid size-8 place-items-center rounded-full text-sm font-semibold", s.done ? "bg-success text-white" : "bg-brand-soft text-brand")} aria-hidden>
                    {s.done ? <Check className="size-4" /> : s.n}
                  </span>
                  <p className="mt-3 font-medium">{s.title}</p>
                  <p className="mt-1 flex-1 text-sm text-muted">{s.text}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
                    {s.done ? "Yönet" : "Başla"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {canAnywhere(user, "users.manage") && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold">Müşteriler nasıl giriş yapar?</p>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Müşteriler kendileri kayıt olamaz. Siz hesabı açar, kullanıcı adı ve parolayı iletirsiniz; müşteri opsuyon.com ana
                sayfasında hizmet alanı butonuna (Güvenlik / Temizlik / Kurumsal Tedarik) tıklayarak giriş yapar.
              </p>
            </div>
            <Link href="/merkez/kullanicilar#yeni" className={btn("primary", "md")}>Hesap aç</Link>
          </div>
        </Card>
      )}
    </>
  );
}
