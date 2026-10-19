import type { Metadata } from "next";
import { Badge, Card, CardHeader, PageHeader, cn } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { getModules } from "@/lib/modules";
import { setModuleEnabled } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Müşteri modülleri" };

/** Müşteri panelinde hangi ekranların görüneceğini belirler: yalnızca istenenler açık, diğerleri kapalı. */
export default async function ModulesPage() {
  await requireStaff("access.manage");
  const modules = await getModules();
  const groups = [
    { title: "Müşterinin istediği ekranlar", hint: "Müşteri panelinde açık olanlar", list: modules.filter((m) => m.implemented && m.sort_order < 200) },
    { title: "Kapalı ekranlar", hint: "Kod hazır, müşteri paneline kapalı. İstenirse açın.", list: modules.filter((m) => m.implemented && m.sort_order >= 200 && m.sort_order < 400) },
    { title: "Test aşaması araçları", hint: "Müşterinin istemediği, yalnızca geliştirme sürecinde yardımcı olan özellikler. Canlıya çıkarken kapatın.", list: modules.filter((m) => m.implemented && m.sort_order >= 400) },
    { title: "Planlandı", hint: "Henüz kodlanmadı (yol haritası Faz 3)", list: modules.filter((m) => !m.implemented) },
  ];

  return (
    <>
      <PageHeader
        title="Müşteri modülleri"
        description="Müşteri paneli yalnızca açık modülleri gösterir. Merkez (yönetici) tarafı her zaman tüm ekranlara erişir."
      />
      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader title={g.title} description={g.hint} />
            <ul className="divide-y divide-border">
              {g.list.map((m) => (
                <li key={m.code} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium">{m.name}</p>
                    {m.description && <p className="text-sm text-muted">{m.description}</p>}
                  </div>
                  {m.implemented ? (
                    <form action={setModuleEnabled} className="flex items-center gap-3">
                      <input type="hidden" name="code" value={m.code} />
                      <input type="hidden" name="enabled" value={m.enabled ? "0" : "1"} />
                      <Badge tone={m.enabled ? "success" : "neutral"}>{m.enabled ? "Açık" : "Kapalı"}</Badge>
                      <button
                        role="switch"
                        aria-checked={m.enabled}
                        aria-label={`${m.name} ${m.enabled ? "kapat" : "aç"}`}
                        className={cn("relative h-6 w-11 rounded-full transition-colors", m.enabled ? "bg-success" : "bg-border")}
                      >
                        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", m.enabled ? "left-[1.375rem]" : "left-0.5")} />
                      </button>
                    </form>
                  ) : (
                    <Badge tone="warning">Planlandı</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
