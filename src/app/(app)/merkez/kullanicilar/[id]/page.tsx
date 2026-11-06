import { Card, CardHeader, cn } from "@/components/ui";
import { ResetPasswordForm, StaffRoleForm } from "@/components/forms/user-forms";
import { formatDateTime } from "@/lib/format";
import { setUserActive } from "@/app/actions/users";
import { loadUserDetail } from "./data";

/** Kullanıcı detayı › Hesap sekmesi: parola, erişim (kısıtla/aktifleştir), merkez rolü. */
export default async function UserAccountPage({ params }: PageProps<"/merkez/kullanicilar/[id]">) {
  const { id } = await params;
  const { u, manage, isSelf, staffRoles } = await loadUserDetail(id);
  return (
    <Card>
      <CardHeader title="Hesap" description={`Son giriş: ${formatDateTime(u.last_login_at)}`} />
      {manage ? (
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <ResetPasswordForm userId={u.id} />

          <div className="space-y-3">
            <p className="text-sm font-medium">Erişim</p>
            <p className="text-sm text-muted">
              {u.is_active ? "Kısıtlandığında kullanıcı anında sisteme giremez." : "Hesap kısıtlı; yeniden aktifleştirebilirsiniz."}
            </p>
            <form action={setUserActive}>
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="active" value={u.is_active ? "0" : "1"} />
              <button
                disabled={isSelf}
                className={cn("h-10 rounded-lg px-4 text-sm font-medium disabled:opacity-50", u.is_active ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}
              >
                {u.is_active ? "Hesabı kısıtla" : "Hesabı aktifleştir"}
              </button>
            </form>
            {isSelf && <p className="text-xs text-muted">Kendi hesabınızı kısıtlayamazsınız.</p>}
          </div>

          {u.kind === "staff" && (
            <div className="lg:col-span-2">
              <StaffRoleForm userId={u.id} roleId={u.staff_role_id ?? ""} roles={staffRoles.map((r) => ({ value: r.id, label: r.name }))} />
            </div>
          )}
        </div>
      ) : (
        <p className="p-5 text-sm text-muted">Kullanıcıları yönetme yetkiniz yok.</p>
      )}
    </Card>
  );
}
