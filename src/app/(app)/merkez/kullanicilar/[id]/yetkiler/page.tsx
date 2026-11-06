import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader, cn } from "@/components/ui";
import { setStaffOverride } from "@/app/actions/users";
import { moduleLabel } from "../data";
import { loadUserDetail } from "../data";

export const metadata: Metadata = { title: "Kişiye özel yetkiler" };

/** Kullanıcı detayı › Kişiye özel yetkiler (yalnızca merkez kullanıcıları). */
export default async function UserPermissionsPage({ params }: PageProps<"/merkez/kullanicilar/[id]/yetkiler">) {
  const { id } = await params;
  const { u, isTargetSuper, staffOverrides, byModule, canEditStaffPerms, staffBase } = await loadUserDetail(id);
  if (u.kind !== "staff") notFound();
  return (
    <Card>
      <CardHeader
        title="Kişiye özel yetkiler"
        description={isTargetSuper ? "Süper yönetici tüm yetkilere sahiptir; kısıtlanamaz." : "Rol bir şablondur. Aşağıdan bu kişi için tek tek izin verebilir veya engelleyebilirsiniz."}
        action={<span className="text-sm text-muted">{staffOverrides.size} kişiye özel ayar</span>}
      />
      {isTargetSuper ? null : (
        <div className="divide-y divide-border">
          {[...byModule.entries()].map(([mod, list]) => (
            <details key={mod} open={list.some((p) => staffOverrides.has(p.code))} className="group">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm font-semibold">
                {moduleLabel[mod] ?? mod}
                <span className="text-xs font-normal text-muted">{list.filter((p) => staffOverrides.has(p.code)).length || ""}</span>
              </summary>
              <ul className="divide-y divide-border border-t border-border bg-surface-2/40">
                {list.map((p) => {
                  const state = staffOverrides.has(p.code) ? (staffOverrides.get(p.code) ? "allow" : "deny") : "default";
                  const effective = state === "allow" || (state === "default" && staffBase.has(p.code));
                  return (
                    <li key={p.code} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span>
                        {p.description}
                        <span className={cn("ml-2 text-xs", effective ? "text-success" : "text-muted")}>{effective ? "• yapabilir" : "• yapamaz"}</span>
                      </span>
                      {canEditStaffPerms ? (
                        <form action={setStaffOverride} className="inline-flex overflow-hidden rounded-lg border border-border bg-surface text-xs">
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="permission_code" value={p.code} />
                          {([["default", `Rol (${staffBase.has(p.code) ? "var" : "yok"})`], ["allow", "İzin ver"], ["deny", "Engelle"]] as const).map(([mode, text]) => (
                            <button
                              key={mode}
                              name="mode"
                              value={mode}
                              aria-pressed={state === mode}
                              className={cn("px-2.5 py-1.5", state === mode ? (mode === "deny" ? "bg-danger-soft text-danger" : mode === "allow" ? "bg-success-soft text-success" : "bg-brand-soft text-brand") : "text-muted hover:bg-surface-2")}
                            >
                              {text}
                            </button>
                          ))}
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      )}
      {!canEditStaffPerms && !isTargetSuper && <p className="border-t border-border px-5 py-3 text-xs text-muted">Kişiye özel yetkiyi yalnızca süper yönetici değiştirebilir.</p>}
    </Card>
  );
}
