import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, cn, inputCls } from "@/components/ui";
import { MembershipForm, ResetPasswordForm, StaffRoleForm } from "@/components/forms/user-forms";
import { hasPermission, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { changeMembershipRole, removeMembership, setOverride, setUserActive } from "@/app/actions/users";
import type { Permission, Profile, Role } from "@/lib/types";

type Member = {
  id: string;
  role_id: string;
  projects: { id: string; name: string; service_line: string } | null;
};

const customerGrantable = (p: Permission) =>
  !["yonetim"].includes(p.module) && !p.code.endsWith(".manage") && p.code !== "messages.manage";

export default async function UserDetail({ params }: PageProps<"/merkez/kullanicilar/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await requireStaff("users.read");
  const manage = hasPermission(me, "users.manage");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(name), roles:staff_role_id(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();
  const u = profile as unknown as Profile & { organizations: { name: string } | null; roles: { id: string; name: string } | null };

  const [{ data: allRoles }, { data: perms }, { data: rolePerms }] = await Promise.all([
    supabase.from("roles").select("*").order("name"),
    supabase.from("permissions").select("*").order("sort_order"),
    supabase.from("role_permissions").select("role_id, permission_code"),
  ]);
  const roles = (allRoles ?? []) as Role[];
  const permissions = ((perms ?? []) as Permission[]).filter(customerGrantable);
  const customerRoles = roles.filter((r) => r.scope === "customer");
  const staffRoles = roles.filter((r) => r.scope === "staff" && (r.code !== "super_admin" || me.roleCode === "super_admin"));
  const roleGrants = new Map<string, Set<string>>();
  (rolePerms ?? []).forEach((rp) => {
    if (!roleGrants.has(rp.role_id)) roleGrants.set(rp.role_id, new Set());
    roleGrants.get(rp.role_id)!.add(rp.permission_code);
  });

  let members: Member[] = [];
  const overrides = new Map<string, Map<string, boolean>>();
  let availableProjects: { id: string; name: string }[] = [];
  if (u.kind === "customer") {
    const [{ data: m }, { data: ov }, { data: pr }] = await Promise.all([
      supabase.from("project_members").select("id, role_id, projects(id, name, service_line)").eq("user_id", id),
      supabase.from("member_permission_overrides").select("member_id, permission_code, is_allowed"),
      supabase.from("projects").select("id, name").eq("organization_id", u.organization_id!).order("name"),
    ]);
    members = (m ?? []) as unknown as Member[];
    (ov ?? []).forEach((o) => {
      if (!overrides.has(o.member_id)) overrides.set(o.member_id, new Map());
      overrides.get(o.member_id)!.set(o.permission_code, o.is_allowed);
    });
    const taken = new Set(members.map((x) => x.projects?.id));
    availableProjects = ((pr ?? []) as { id: string; name: string }[]).filter((p) => !taken.has(p.id));
  }

  const isSelf = me.id === u.id;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/merkez/kullanicilar" className="inline-flex items-center gap-1 hover:text-fg"><ChevronLeft className="size-4" aria-hidden /> Kullanıcılar</Link>}
        title={u.full_name}
        description={`@${u.username} · ${u.kind === "staff" ? (u.roles?.name ?? "Merkez") : (u.organizations?.name ?? "Müşteri")}`}
        actions={<Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Aktif" : "Kısıtlı"}</Badge>}
      />

      <div className="space-y-6">
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

        {u.kind === "customer" && (
          <>
            <Card>
              <CardHeader title="Proje erişimleri" description="Kullanıcı yalnızca burada tanımlı projelere ve verilen izinlere ulaşır." />
              {members.length === 0 ? (
                <EmptyState title="Henüz hiçbir projeye erişimi yok" description="Aşağıdan bir proje ekleyin." />
              ) : (
                <ul className="divide-y divide-border">
                  {members.map((m) => {
                    const base = roleGrants.get(m.role_id) ?? new Set<string>();
                    const ov = overrides.get(m.id) ?? new Map<string, boolean>();
                    return (
                      <li key={m.id} className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Link href={`/projeler/${m.projects?.id}`} className="font-medium hover:text-brand">{m.projects?.name}</Link>
                          {manage && (
                            <div className="flex flex-wrap items-center gap-2">
                              <form action={changeMembershipRole} className="flex items-center gap-2">
                                <input type="hidden" name="id" value={m.id} />
                                <input type="hidden" name="user_id" value={u.id} />
                                <select name="role_id" defaultValue={m.role_id} className={inputCls + " h-9 w-auto"} aria-label="Rol">
                                  {customerRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <button className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-surface-2">Rolü değiştir</button>
                              </form>
                              <form action={removeMembership}>
                                <input type="hidden" name="id" value={m.id} />
                                <input type="hidden" name="user_id" value={u.id} />
                                <button className="h-9 rounded-lg px-3 text-sm text-danger hover:bg-danger-soft">Erişimi kaldır</button>
                              </form>
                            </div>
                          )}
                        </div>

                        <details className="mt-4 rounded-xl border border-border">
                          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
                            İzinleri ince ayarla <span className="text-muted">({ov.size} istisna)</span>
                          </summary>
                          <ul className="divide-y divide-border border-t border-border">
                            {permissions.map((p) => {
                              const state = ov.has(p.code) ? (ov.get(p.code) ? "allow" : "deny") : "default";
                              const effective = state === "allow" || (state === "default" && base.has(p.code));
                              return (
                                <li key={p.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                                  <span>
                                    {p.description}
                                    <span className={cn("ml-2 text-xs", effective ? "text-success" : "text-muted")}>
                                      {effective ? "• erişebilir" : "• erişemez"}
                                    </span>
                                  </span>
                                  {manage && (
                                    <form action={setOverride} className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
                                      <input type="hidden" name="member_id" value={m.id} />
                                      <input type="hidden" name="user_id" value={u.id} />
                                      <input type="hidden" name="permission_code" value={p.code} />
                                      {([["default", `Rol (${base.has(p.code) ? "var" : "yok"})`], ["allow", "İzin ver"], ["deny", "Engelle"]] as const).map(([mode, text]) => (
                                        <button
                                          key={mode}
                                          name="mode"
                                          value={mode}
                                          aria-pressed={state === mode}
                                          className={cn(
                                            "px-2.5 py-1.5",
                                            state === mode
                                              ? mode === "deny" ? "bg-danger-soft text-danger" : mode === "allow" ? "bg-success-soft text-success" : "bg-brand-soft text-brand"
                                              : "text-muted hover:bg-surface-2",
                                          )}
                                        >
                                          {text}
                                        </button>
                                      ))}
                                    </form>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {manage && availableProjects.length > 0 && (
              <Card>
                <CardHeader title="Projeye erişim ver" description="Yalnızca kullanıcının firmasına ait projeler listelenir." />
                <MembershipForm
                  userId={u.id}
                  projects={availableProjects.map((p) => ({ value: p.id, label: p.name }))}
                  roles={customerRoles.map((r) => ({ value: r.id, label: r.name }))}
                  defaultRoleId={customerRoles.find((r) => r.code === "customer_viewer")?.id}
                />
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
