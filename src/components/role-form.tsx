"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteRole, saveRole } from "@/app/actions/roles";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { btn, cn, inputCls } from "@/components/ui";
import { PERMISSION_GROUPS, SCOPE_PATH, isManagePermission, type PermissionRow, type RoleScope } from "@/lib/permissions";

type Template = { id: string; name: string; permissions: string[] };

/** Değiştirme yetkisi, ilgili görme yetkisi olmadan işe yaramaz (menü görme yetkisine bakar): birlikte işaretlenir. */
const EXTRA_READ: Record<string, string[]> = {
  "finance.manage": ["ledger.read", "invoices.read", "payments.read"],
  "messages.manage": ["messages.use"],
};
const readsFor = (code: string, known: Set<string>): string[] =>
  [code.replace(/.manage$/, ".read"), ...(EXTRA_READ[code] ?? [])].filter((c) => c !== code && known.has(c));

function PermBox({ p, checked, disabled, onToggle }: { p: PermissionRow; checked: boolean; disabled: boolean; onToggle: (code: string) => void }) {
  return (
    <label className={cn("flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm", !disabled && "cursor-pointer hover:bg-surface-2")}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" checked={checked} disabled={disabled} onChange={() => onToggle(p.code)} />
      <span className={cn(checked ? "text-fg" : "text-muted")}>{p.description}</span>
    </label>
  );
}

/**
 * Rol düzenleme: ad, açıklama ve yetki kutuları (alanlara göre gruplu; "Görme" ve "Değiştirme" ayrı sütunlarda).
 * Müşteri rollerinde yalnızca müşteriye verilebilir (görme) yetkiler listelenir. `readOnly`: Süper Yönetici
 * olmayanlar rolü yalnızca görür.
 */
export function RoleForm({
  scope, role, permissions, templates, readOnly, locked, used,
}: {
  scope: RoleScope;
  role: { id: string; name: string; description: string; permissions: string[]; isSystem: boolean } | null;
  permissions: PermissionRow[];
  /** "Şu rolden kopyala" (yalnızca yeni rolde) */
  templates: Template[];
  readOnly: boolean;
  /** Süper Yönetici rolü: yetkiler seçilmez */
  locked?: boolean;
  /** rolü kullanan hesap sayısı (silme için) */
  used: number;
}) {
  const router = useRouter();
  const nameId = useId();
  const descId = useId();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const disabled = Boolean(readOnly || locked || pending);

  const groups = useMemo(
    () =>
      PERMISSION_GROUPS.map((g) => {
        const list = permissions.filter((p) => p.module === g.module);
        return { ...g, read: list.filter((p) => !isManagePermission(p.code)), manage: list.filter((p) => isManagePermission(p.code)) };
      }).filter((g) => g.read.length + g.manage.length > 0),
    [permissions],
  );

  const known = useMemo(() => new Set(permissions.map((p) => p.code)), [permissions]);
  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else {
        next.add(code);
        if (isManagePermission(code)) readsFor(code, known).forEach((c) => next.add(c));
      }
      return next;
    });
  const setMany = (codes: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => {
        if (!on) return void next.delete(c);
        next.add(c);
        if (isManagePermission(c)) readsFor(c, known).forEach((r) => next.add(r));
      });
      return next;
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setState(null);
    start(async () => {
      const res = await saveRole({ id: role?.id ?? "", scope, name, description, permissions: [...selected] });
      if (res?.ok) {
        setState({ ok: true, text: res.message ?? "Kaydedildi." });
        if (!role && "id" in res && res.id) router.push(`${SCOPE_PATH[scope]}/${res.id}`);
        else router.refresh();
      } else setState({ ok: false, text: res?.fieldErrors?.name ?? res?.error ?? "Kaydedilemedi." });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-medium">Rol adı<span aria-hidden className="ml-0.5 text-danger">*</span></label>
          <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required disabled={readOnly || pending} placeholder="Örn. Saha Sorumlusu" className={cn(inputCls, "h-10")} />
        </div>
        <div>
          <label htmlFor={descId} className="mb-1.5 block text-sm font-medium">Açıklama</label>
          <input id={descId} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} disabled={readOnly || pending} placeholder="Bu rol kimler için?" className={cn(inputCls, "h-10")} />
        </div>
        {!role && templates.length > 0 && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium" htmlFor={`${nameId}-tpl`}>Yetkileri şu rolden kopyala (isteğe bağlı)</label>
            <select
              id={`${nameId}-tpl`}
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value);
                if (t) setSelected(new Set(t.permissions));
              }}
              className={cn(inputCls, "h-10 sm:max-w-sm")}
            >
              <option value="">Boş başla…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted">Seçtiğiniz rolün yetkileri işaretlenir; sonra istediğinizi ekleyip çıkarabilirsiniz.</p>
          </div>
        )}
      </div>

      {locked ? (
        <p className="mx-5 rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand">Süper Yönetici tüm yetkilere sahiptir; yetkileri seçilmez ve kısıtlanamaz.</p>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {groups.map((g) => {
            const codes = [...g.read, ...g.manage].map((p) => p.code);
            const count = codes.filter((c) => selected.has(c)).length;
            return (
              <fieldset key={g.module} className="px-5 py-4">
                <legend className="sr-only">{g.label}</legend>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold" aria-hidden>{g.label} <span className="ml-1 text-xs font-normal text-muted">{count} / {codes.length}</span></p>
                    <p className="text-xs text-muted">{g.hint}</p>
                  </div>
                  {!disabled && (
                    <div className="flex gap-3 text-xs font-medium">
                      <button type="button" onClick={() => setMany(codes, true)} className="text-brand hover:underline">Tümünü seç</button>
                      <button type="button" onClick={() => setMany(codes, false)} className="text-muted hover:underline">Temizle</button>
                    </div>
                  )}
                </div>
                <div className={cn("mt-3 grid gap-x-6 gap-y-3", g.manage.length > 0 && "lg:grid-cols-2")}>
                  {g.read.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Eye className="size-3.5" aria-hidden /> Görme</p>
                      <div className={cn("grid gap-x-4", g.manage.length === 0 && "sm:grid-cols-2")}>{g.read.map((p) => <PermBox key={p.code} p={p} checked={selected.has(p.code)} disabled={disabled} onToggle={toggle} />)}</div>
                    </div>
                  )}
                  {g.manage.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Pencil className="size-3.5" aria-hidden /> Değiştirme</p>
                      <div>{g.manage.map((p) => <PermBox key={p.code} p={p} checked={selected.has(p.code)} disabled={disabled} onToggle={toggle} />)}</div>
                    </div>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
        {!readOnly && !locked && (
          <button type="submit" disabled={pending} className={btn("primary", "md")}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {role ? "Rolü kaydet" : "Rolü oluştur"}
          </button>
        )}
        {!readOnly && !locked && <span className="text-sm text-muted">{selected.size} yetki seçili</span>}
        {readOnly && <span className="text-sm text-muted">Rolleri yalnızca Süper Yönetici düzenleyebilir.</span>}
        {state && (
          <span role={state.ok ? "status" : "alert"} className={cn("inline-flex items-center gap-1.5 text-sm", state.ok ? "text-success" : "text-danger")}>
            {state.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertCircle className="size-4" aria-hidden />} {state.text}
          </span>
        )}
        {role && !role.isSystem && !readOnly && (
          <span className="ml-auto">
            <ConfirmDialog
              title={`“${role.name}” rolü silinsin mi?`}
              description={used > 0 ? `Bu rol ${used} hesapta kullanılıyor; silinemez. Önce o hesaplara başka rol verin.` : "Rol kalıcı olarak silinir. Bu işlem geri alınamaz."}
              confirmLabel="Rolü sil"
              onConfirm={() =>
                start(async () => {
                  const res = await deleteRole({ id: role.id });
                  if (res?.ok) router.push(SCOPE_PATH[scope]);
                  else setState({ ok: false, text: res?.error ?? "Silinemedi." });
                })
              }
            >
              <button type="button" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft">
                <Trash2 className="size-4" aria-hidden /> Rolü sil
              </button>
            </ConfirmDialog>
          </span>
        )}
      </div>
    </form>
  );
}
