import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Notice, Table, btn, cn, td, tdNum } from "@/components/ui";
import { RoleForm } from "@/components/role-form";
import { hasPermission, requireStaff, type CurrentUser } from "@/lib/auth";
import { menuFor } from "@/lib/menu";
import { getEnabledModules } from "@/lib/modules";
import { SCOPE_PATH, type PermissionRow, type RoleScope } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

type RoleRow = { id: string; code: string; name: string; description: string | null; scope: RoleScope; is_system: boolean };

/** Roller ve yetkiler bölümünü kim görür: Süper Yönetici ve "rol tanımlarını görüntüle" (access.manage) yetkisi olanlar. */
export async function requireRolesAccess(): Promise<{ user: CurrentUser; isSuper: boolean }> {
  const user = await requireStaff();
  const isSuper = user.roleCode === "super_admin";
  if (!isSuper && !hasPermission(user, "access.manage")) redirect("/merkez?yetki=yok");
  return { user, isSuper };
}

const TEXT: Record<RoleScope, { title: string; intro: string; usedBy: string; empty: string }> = {
  staff: {
    title: "Merkez rolleri",
    intro: "Merkez çalışanlarının (kendi ekibiniz) rolleri. Her merkez hesabının tek rolü vardır ve yetkisi TÜM firmalar ve projeler için geçerlidir.",
    usedBy: "Hesap",
    empty: "Merkez rolü yok.",
  },
  customer: {
    title: "Müşteri rolleri",
    intro: "Müşteri hesaplarının rolleri. Rol, hesaba PROJE BAZINDA verilir: aynı kişi bir projede yönetici, diğerinde yalnızca izleyici olabilir. Müşteri yalnızca görebilir; değiştirme yetkisi verilemez.",
    usedBy: "Proje erişimi",
    empty: "Müşteri rolü yok.",
  },
};

/** Rol listesi (bir kapsam): ad, açıklama, yetki sayısı, kaç hesapta kullanıldığı. */
export async function RoleListPage({ scope }: { scope: RoleScope }) {
  const { isSuper } = await requireRolesAccess();
  const supabase = await createClient();
  const [{ data: roles }, { data: rp }, { data: staff }, { data: members }] = await Promise.all([
    supabase.from("roles").select("id, code, name, description, scope, is_system").eq("scope", scope).order("is_system", { ascending: false }).order("name"),
    supabase.from("role_permissions").select("role_id"),
    scope === "staff" ? supabase.from("profiles").select("staff_role_id").eq("kind", "staff") : Promise.resolve({ data: [] }),
    scope === "customer" ? supabase.from("project_members").select("role_id") : Promise.resolve({ data: [] }),
  ]);
  const list = (roles ?? []) as RoleRow[];
  const count = (rows: { [k: string]: unknown }[] | null, key: string) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => r[key] && m.set(r[key] as string, (m.get(r[key] as string) ?? 0) + 1));
    return m;
  };
  const permCount = count(rp as { role_id: string }[] | null, "role_id");
  const usedCount = scope === "staff" ? count(staff as { staff_role_id: string }[] | null, "staff_role_id") : count(members as { role_id: string }[] | null, "role_id");
  const t = TEXT[scope];
  const base = SCOPE_PATH[scope];

  return (
    <Card>
      <CardHeader
        title={t.title}
        description={t.intro}
        action={isSuper ? <Link href={`${base}/yeni`} className={btn("primary", "sm")}><Plus className="size-4" aria-hidden /> Yeni rol</Link> : undefined}
      />
      {list.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <Table head={["Rol", "Açıklama", "Yetki", t.usedBy, ""]} numeric={[2, 3]}>
          {list.map((r) => (
            <tr key={r.id} className="hover:bg-surface-2/60">
              <td className={cn(td, "whitespace-nowrap font-medium")}>
                <Link href={`${base}/${r.id}`} className="hover:text-brand">{r.name}</Link>
                <span className="ml-2 align-middle"><Badge tone={r.is_system ? "neutral" : "brand"}>{r.is_system ? "Hazır rol" : "Özel rol"}</Badge></span>
              </td>
              <td className={cn(td, "text-muted")}>{r.description ?? "—"}</td>
              <td className={tdNum}>{r.code === "super_admin" ? "Tümü" : (permCount.get(r.id) ?? 0)}</td>
              <td className={tdNum}>{usedCount.get(r.id) ?? 0}</td>
              <td className={cn(td, "text-right")}>
                <Link href={`${base}/${r.id}`} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-brand hover:underline">
                  {isSuper && r.code !== "super_admin" ? "Düzenle" : "Görüntüle"} <ChevronRight className="size-4" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/** Rol düzenleme / yeni rol (id = "yeni"). Altında bu rolle görünen menülerin önizlemesi. */
export async function RoleEditPage({ scope, id }: { scope: RoleScope; id: string }) {
  const { isSuper } = await requireRolesAccess();
  const isNew = id === "yeni";
  if (isNew && !isSuper) redirect(SCOPE_PATH[scope]);
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [{ data: permRows }, { data: roleRows }, { data: rpRows }, on] = await Promise.all([
    supabase.from("permissions").select("code, module, description, sort_order, customer_grantable").order("sort_order"),
    supabase.from("roles").select("id, code, name, description, scope, is_system").eq("scope", scope).order("name"),
    supabase.from("role_permissions").select("role_id, permission_code"),
    getEnabledModules(),
  ]);
  const all = (permRows ?? []) as PermissionRow[];
  const permissions = scope === "customer" ? all.filter((p) => p.customer_grantable) : all;
  const roles = (roleRows ?? []) as RoleRow[];
  const byRole = new Map<string, string[]>();
  (rpRows ?? []).forEach((r) => byRole.set(r.role_id as string, [...(byRole.get(r.role_id as string) ?? []), r.permission_code as string]));

  const role = isNew ? null : roles.find((r) => r.id === id);
  if (!isNew && !role) notFound();
  const locked = role?.code === "super_admin";
  const own = role ? (byRole.get(role.id) ?? []) : [];

  let used = 0;
  if (role) {
    const { count } =
      scope === "staff"
        ? await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("staff_role_id", role.id)
        : await supabase.from("project_members").select("id", { count: "exact", head: true }).eq("role_id", role.id);
    used = count ?? 0;
  }

  // Önizleme: bu rolle (kayıtlı haliyle) sol menüde hangi ekranlar görünür?
  const fake = {
    kind: scope === "staff" ? "staff" : "customer",
    roleCode: role?.code ?? null,
    permissions: scope === "staff" ? own : [],
    allPermissions: own,
  } as unknown as CurrentUser;
  const menu = role ? menuFor(fake, on).filter((m) => !["/merkez", "/panel"].includes(m.href)) : [];
  const base = SCOPE_PATH[scope];

  return (
    <div className="space-y-6">
      <Link href={base} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> {TEXT[scope].title}
      </Link>
      <Card>
        <CardHeader
          title={isNew ? `Yeni ${scope === "staff" ? "merkez" : "müşteri"} rolü` : role!.name}
          description={
            isNew
              ? scope === "staff"
                ? "Merkez çalışanları için bir rol. Yetkiler tüm firmalar ve projeler için geçerli olur."
                : "Müşteri hesapları için bir rol. Hesaba proje bazında verilir; yalnızca görme yetkileri seçilebilir."
              : `${role!.is_system ? "Hazır rol (silinemez)" : "Özel rol"} · ${used} ${scope === "staff" ? "hesapta" : "proje erişiminde"} kullanılıyor · değişiklik bu roldeki herkese hemen yansır`
          }
        />
        <RoleForm
          key={role?.id ?? "yeni"}
          scope={scope}
          role={role ? { id: role.id, name: role.name, description: role.description ?? "", permissions: own, isSystem: role.is_system } : null}
          permissions={permissions}
          templates={isNew ? roles.filter((r) => r.code !== "super_admin").map((r) => ({ id: r.id, name: r.name, permissions: byRole.get(r.id) ?? [] })) : []}
          readOnly={!isSuper}
          locked={locked}
          used={used}
        />
      </Card>

      {role && (
        <Card>
          <CardHeader
            title="Bu rolle görünen menüler"
            description={
              scope === "customer"
                ? "Kayıtlı yetkilere göre müşteri panelinde görünen ekranlar. Müşteri ekranları sekmesinde kapalı olan ekranlar, yetki olsa da görünmez."
                : "Kayıtlı yetkilere göre merkez menüsünde görünen ekranlar."
            }
          />
          {menu.length === 0 ? (
            <div className="p-5"><Notice tone="warning">Bu rol hiçbir menüyü görmüyor; en az bir görme yetkisi seçip kaydedin.</Notice></div>
          ) : (
            <ul className="flex flex-wrap gap-2 p-5">
              {menu.map((m) => (
                <li key={m.href + m.label} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm">{m.group ? `${m.group} › ` : ""}{m.label}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
