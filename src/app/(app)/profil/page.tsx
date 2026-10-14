import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { ChangePasswordForm } from "@/components/forms/profile-forms";
import { logoutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: org } = user.organization_id
    ? await supabase.from("organizations").select("name").eq("id", user.organization_id).maybeSingle()
    : { data: null };

  const rows: [string, string][] = [
    ["Ad soyad", user.full_name],
    ["Kullanıcı adı", `@${user.username}`],
    ["Hesap türü", user.kind === "staff" ? (user.roleName ?? "Merkez") : "Müşteri"],
    ...(org?.name ? ([["Firma", org.name]] as [string, string][]) : []),
    ["Telefon", user.phone ?? "—"],
    ["Son giriş", formatDateTime(user.last_login_at)],
  ];

  return (
    <>
      <PageHeader title="Profil" description="Hesap bilgileriniz ve parola değişikliği." actions={<Badge tone={user.kind === "staff" ? "brand" : "neutral"}>{user.kind === "staff" ? "Merkez" : "Müşteri"}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Hesap bilgileri" description="Bilgileri merkez yönetir." />
          <dl className="divide-y divide-border">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Parolayı değiştir" />
          <ChangePasswordForm />
        </Card>
      </div>
      <form action={logoutAction} className="mt-6 lg:hidden">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-danger">
          <LogOut className="size-4" aria-hidden /> Çıkış yap
        </button>
      </form>
    </>
  );
}
