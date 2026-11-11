import Link from "next/link";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Card, CardHeader, cn } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import { menuFor } from "@/lib/menu";
import { getEnabledModules } from "@/lib/modules";
import type { RoleScope } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireRolesAccess } from "./role-pages";

export const metadata: Metadata = { title: "Roller ve yetkiler" };

type RoleRow = { id: string; code: string; name: string; scope: RoleScope };

const STEPS = [
  {
    no: "1",
    title: "Hesap türü",
    text: "Her hesap ya Merkez hesabıdır (kendi ekibiniz) ya da Müşteri hesabıdır (bir firmaya bağlı). Tür, hesabın hangi panele gireceğini belirler ve sonradan yalnızca Süper Yönetici değiştirebilir.",
  },
  {
    no: "2",
    title: "Rol = yetki paketi",
    text: "Rol, bir arada verilen yetkilerin adıdır. Merkez hesabının TEK rolü vardır ve tüm firmalarda geçerlidir. Müşteri hesabına rol PROJE BAZINDA verilir: aynı kişi bir projede yönetici, diğerinde izleyici olabilir.",
  },
  {
    no: "3",
    title: "Kişiye özel istisna",
    text: "Rol çoğu kişiye yeter. Tek bir kişi için rolden farklı bir şey gerekiyorsa kullanıcının sayfasından o yetki tek tek “İzin ver” ya da “Engelle” yapılır; rol değişmez.",
  },
];

/** Bir kapsamın rollerinin menüde gördüğü ekranlar (satır: ekran, sütun: rol). */
function Matrix({ roles, screens, seen }: { roles: RoleRow[]; screens: string[]; seen: Map<string, Set<string>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/60 text-left text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-5 py-2.5 font-medium">Ekran</th>
            {roles.map((r) => (
              <th key={r.id} scope="col" className="px-3 py-2.5 text-center font-medium normal-case tracking-normal">{r.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {screens.map((s) => (
            <tr key={s}>
              <th scope="row" className="whitespace-nowrap px-5 py-2 text-left font-medium">{s}</th>
              {roles.map((r) => {
                const yes = seen.get(r.id)?.has(s) ?? false;
                return (
                  <td key={r.id} className="px-3 py-2 text-center">
                    <span className={cn("inline-grid size-5 place-items-center rounded-full", yes ? "bg-success-soft text-success" : "text-border")}>
                      {yes ? <Check className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                    </span>
                    <span className="sr-only">{yes ? "görür" : "görmez"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Genel bakış: yetkinin nasıl belirlendiği + her rolün gördüğü ekranlar (kayıtlı yetkilerden hesaplanır). */
export default async function AccessOverviewPage() {
  await requireRolesAccess();
  const supabase = await createClient();
  const [{ data: roleRows }, { data: rp }, on] = await Promise.all([
    supabase.from("roles").select("id, code, name, scope").order("is_system", { ascending: false }).order("name"),
    supabase.from("role_permissions").select("role_id, permission_code"),
    getEnabledModules(),
  ]);
  const roles = ((roleRows ?? []) as RoleRow[]).filter((r) => !/kullanılmıyor/i.test(r.name));
  const perms = new Map<string, string[]>();
  (rp ?? []).forEach((r) => perms.set(r.role_id as string, [...(perms.get(r.role_id as string) ?? []), r.permission_code as string]));

  const build = (scope: RoleScope) => {
    const list = roles.filter((r) => r.scope === scope);
    const seen = new Map<string, Set<string>>();
    const order: string[] = [];
    for (const r of list) {
      const own = perms.get(r.id) ?? [];
      const fake = { kind: scope, roleCode: r.code, permissions: scope === "staff" ? own : [], allPermissions: own } as unknown as CurrentUser;
      const labels = menuFor(fake, on).filter((m) => !["/merkez", "/panel"].includes(m.href)).map((m) => (m.group ? `${m.group} › ${m.label}` : m.label));
      seen.set(r.id, new Set(labels));
      labels.forEach((l) => !order.includes(l) && order.push(l));
    }
    return { list, seen, screens: order };
  };
  const cust = build("customer");
  const staff = build("staff");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Yetki nasıl belirlenir?" description="Bir kişinin ne göreceği üç şeye bakılarak bulunur; müşterilerde bir de ekranın açık olması gerekir." />
        <ol className="grid gap-4 p-5 lg:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.no} className="rounded-xl border border-border bg-surface-2/40 p-4">
              <p className="flex items-center gap-2 font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg" aria-hidden>{s.no}</span> {s.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="border-t border-border px-5 py-4 text-sm leading-relaxed">
          <p className="font-semibold">Müşteri ekranları (eski adıyla “Müşteri modülleri”) ne işe yarar?</p>
          <p className="mt-1 text-muted">
            Rol “bu KİŞİ ne görebilir?” sorusunu yanıtlar. Müşteri ekranları ise “bu ekran müşteri panelinde VAR MI?” sorusunu yanıtlar ve TÜM müşteriler için tek bir açma/kapama düğmesidir.
            Bir ekranı orada kapatırsanız rolü ne olursa olsun hiçbir müşteri görmez; merkez tarafı etkilenmez. Yani bir müşteri bir ekranı ancak şu ikisi birlikte doğruysa görür:
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 font-medium">
            <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-brand">Ekran açık</span>
            <span className="text-muted">ve</span>
            <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-brand">o projedeki rolünde yetkisi var</span>
            <span className="text-muted">(ayrıca hesap, firma ve proje aktif olmalı)</span>
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Müşteri rolleri hangi ekranları görür?"
          description="Kayıtlı yetkilere ve şu an açık olan müşteri ekranlarına göre. Değiştirmek için Müşteri rolleri sekmesinden rolü açın."
          action={<Link href="/merkez/yetkiler/musteri-rolleri" className="text-sm font-medium text-brand hover:underline">Müşteri rolleri</Link>}
        />
        <Matrix roles={cust.list} screens={cust.screens} seen={cust.seen} />
      </Card>

      <Card>
        <CardHeader
          title="Merkez rolleri hangi ekranları görür?"
          description="Süper Yönetici her şeyi görür ve kısıtlanamaz. Diğer roller Merkez rolleri sekmesinden düzenlenir."
          action={<Link href="/merkez/yetkiler/merkez-rolleri" className="text-sm font-medium text-brand hover:underline">Merkez rolleri</Link>}
        />
        <Matrix roles={staff.list} screens={staff.screens} seen={staff.seen} />
      </Card>

      <Card>
        <CardHeader title="Yetkileri kim değiştirebilir?" />
        <ul className="divide-y divide-border text-sm">
          <li className="px-5 py-3"><span className="font-semibold">Süper Yönetici:</span> <span className="text-muted">rol açar, rollerin yetkilerini değiştirir; merkez hesabı açar, rolünü değiştirir, parolasını sıfırlar, kısıtlar; merkez çalışanına kişiye özel yetki verir. Son Süper Yönetici hesabı kısıtlanamaz.</span></li>
          <li className="px-5 py-3"><span className="font-semibold">“Kullanıcı yönetme” yetkisi olan merkez çalışanı:</span> <span className="text-muted">yalnızca MÜŞTERİ hesaplarını yönetir (hesap açar, projeye erişim verir, proje rolünü değiştirir, müşteriye kişiye özel görme yetkisi verir, parola sıfırlar, kısıtlar). Merkez hesaplarına ve rollere dokunamaz.</span></li>
          <li className="px-5 py-3"><span className="font-semibold">“Müşteri ekranlarını aç / kapat” yetkisi olan merkez çalışanı:</span> <span className="text-muted">Müşteri ekranları sekmesindeki düğmeleri kullanır ve bu bölümü görüntüler.</span></li>
          <li className="px-5 py-3"><span className="font-semibold">Müşteriler:</span> <span className="text-muted">hiçbir yetkiyi değiştiremez; yalnızca kendi firmasının verisini, rolünün izin verdiği kadar görür.</span></li>
        </ul>
      </Card>
    </div>
  );
}
