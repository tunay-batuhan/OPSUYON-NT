import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState, cn, inputCls } from "@/components/ui";
import { changeMembershipRole, removeMembership, setOverride } from "@/app/actions/users";
import { loadUserDetail } from "../data";

export const metadata: Metadata = { title: "Proje erişimleri" };

/** Kullanıcı detayı › Proje erişimleri (müşteri): proje rolü, erişimi kaldır, izin istisnaları. */
export default async function UserAccessPage({ params }: PageProps<"/merkez/kullanicilar/[id]/erisim">) {
  const { id } = await params;
  const { u, manage, members, roleGrants, overrides, permissions, customerRoles } = await loadUserDetail(id);
  if (u.kind !== "customer") notFound();
  return (
    <Card>
      <CardHeader title="Proje erişimleri" description="Kullanıcı yalnızca burada tanımlı projelere ve verilen izinlere ulaşır." />
      {members.length === 0 ? (
        <EmptyState title="Henüz hiçbir projeye erişimi yok" description="Projeye erişim ver sekmesinden bir proje ekleyin." />
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
  );
}
