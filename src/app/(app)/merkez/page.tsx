import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Building2, Check, FolderKanban, MessageSquare, UserCog, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Stat, btn, cn } from "@/components/ui";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Thread } from "@/lib/types";

export const metadata: Metadata = { title: "Genel bakış" };

export default async function MerkezHome({ searchParams }: PageProps<"/merkez">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;

  const [orgs, projects, customers, personnel, threads] = await Promise.all([
    hasPermission(user, "organizations.read") ? supabase.from("organizations").select("id", head).eq("status", "active") : null,
    hasPermission(user, "projects.read") ? supabase.from("projects").select("id", head).eq("status", "active") : null,
    hasPermission(user, "users.read") ? supabase.from("profiles").select("id", head).eq("kind", "customer").eq("is_active", true) : null,
    hasPermission(user, "personnel.read") ? supabase.from("personnel").select("id", head).eq("status", "active") : null,
    hasPermission(user, "messages.manage")
      ? supabase.from("threads").select("*, projects(name, organizations(name))").eq("status", "open").order("last_message_at", { ascending: false }).limit(6)
      : null,
  ]);
  const openThreads = (threads?.data ?? []) as unknown as Thread[];

  const steps = [
    { n: 1, title: "Firma ekle", text: "Hizmet verdiğiniz müşteri firmayı tanımlayın.", href: "/merkez/firmalar#yeni", done: (orgs?.count ?? 0) > 0, show: orgs !== null },
    { n: 2, title: "Proje oluştur", text: "Firmaya bağlı proje açın, hizmet alanını seçin.", href: "/merkez/projeler#yeni", done: (projects?.count ?? 0) > 0, show: projects !== null },
    { n: 3, title: "Müşteri hesabı aç", text: "Kullanıcı adı ve parola üretip müşteriye iletin.", href: "/merkez/kullanicilar#yeni", done: (customers?.count ?? 0) > 0, show: customers !== null },
    { n: 4, title: "Personel ekle", text: "Personeli havuza ekleyip projelere atayın.", href: "/merkez/personel#yeni", done: (personnel?.count ?? 0) > 0, show: personnel !== null },
  ].filter((s) => s.show);
  const allDone = steps.every((s) => s.done);

  return (
    <>
      <PageHeader title={`Hoş geldiniz, ${user.full_name.split(" ")[0]}`} description="Operasyonun anlık özeti." />
      {sp.yetki === "yok" && (
        <div className="mb-6"><Notice tone="warning">Bu bölüme erişim yetkiniz bulunmuyor.</Notice></div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {orgs && <Stat label="Aktif firma" value={orgs.count ?? 0} icon={Building2} tone="blue" />}
        {projects && <Stat label="Aktif proje" value={projects.count ?? 0} icon={FolderKanban} tone="violet" />}
        {personnel && <Stat label="Aktif personel" value={personnel.count ?? 0} icon={Users} tone="emerald" />}
        {customers && <Stat label="Müşteri hesabı" value={customers.count ?? 0} icon={UserCog} tone="amber" />}
      </div>

      {!allDone && (
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
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-full text-sm font-semibold",
                      s.done ? "bg-success text-white" : "bg-brand-soft text-brand",
                    )}
                    aria-hidden
                  >
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

      {customers && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold">Müşteriler nasıl giriş yapar?</p>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Müşteriler kendileri kayıt olamaz. Siz hesabı açar, kullanıcı adı ve parolayı iletirsiniz; müşteri opsuyon.com ana
                sayfasında hizmet alanı butonuna (Güvenlik / Temizlik / Kurumsal Tedarik) tıklayarak giriş yapar.
              </p>
            </div>
            {hasPermission(user, "users.manage") && (
              <Link href="/merkez/kullanicilar#yeni" className={btn("primary", "md")}>Hesap aç</Link>
            )}
          </div>
        </Card>
      )}

      {threads && (
        <Card className="mt-6">
          <CardHeader title="Açık yazışmalar" action={<Link href="/mesajlar" className="text-sm font-medium text-brand">Tümü</Link>} />
          {openThreads.length === 0 ? (
            <EmptyState title="Açık konu yok" />
          ) : (
            <ul className="divide-y divide-border">
              {openThreads.map((t) => (
                <li key={t.id}>
                  <Link href={`/mesajlar/${t.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <MessageSquare className="size-4 shrink-0 text-muted" aria-hidden />
                      <span className="truncate">
                        <span className="font-medium">{t.subject}</span>
                        <span className="text-muted"> · {t.projects?.organizations?.name} / {t.projects?.name}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(t.last_message_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
