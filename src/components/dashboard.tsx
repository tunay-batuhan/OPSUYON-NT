import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, FolderKanban, MessageSquare, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, LineIcon, Stat, lineColor } from "@/components/ui";
import { Donut } from "@/components/donut";
import { canAnywhere, type CurrentUser } from "@/lib/auth";
import { getServiceLines } from "@/lib/lines";
import { getNotificationCounts } from "@/lib/notifications";
import { getEnabledModules } from "@/lib/modules";
import { DownloadLink } from "@/components/doc-ui";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, isoDayFromNow } from "@/lib/format";

type MsgRow = {
  id: string; body: string; sender_name: string; sender_kind: string; created_at: string; thread_id: string;
  threads: { subject: string; projects: { name: string } | null } | null;
};

/** Home screen for merkez (/merkez) and customers (/panel); RLS decides what each one sees. */
export async function Dashboard({ user }: { user: CurrentUser }) {
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;
  const soon = isoDayFromNow(60);
  const today = isoDayFromNow(0);
  const staff = user.kind === "staff";

  const enabled = await getEnabledModules();
  const showRisk = (staff || enabled.has("risk_analizi")) && canAnywhere(user, "risk.read");
  const [lines, projects, assignments, orgs, expiring, messages, counts, risk] = await Promise.all([
    getServiceLines(),
    supabase.from("projects").select("id, service_line").eq("status", "active"),
    supabase.from("personnel_assignments").select("personnel_id, project_id").is("end_date", null),
    staff && canAnywhere(user, "organizations.read") ? supabase.from("organizations").select("id", head).eq("status", "active") : null,
    supabase.from("projects").select("id", head).eq("status", "active").gte("end_date", today).lte("end_date", soon),
    canAnywhere(user, "messages.use") || canAnywhere(user, "messages.manage")
      ? supabase.from("messages").select("id, body, sender_name, sender_kind, created_at, thread_id, threads(subject, projects(name))").order("created_at", { ascending: false }).limit(4)
      : null,
    getNotificationCounts(),
    showRisk
      ? supabase.from("documents").select("id, title, created_at, projects(name)").eq("category_code", "risk_analizi").order("created_at", { ascending: false }).limit(6)
      : null,
  ]);
  const riskDocs = ((risk?.data ?? []) as unknown as { id: string; title: string; created_at: string; projects: { name: string } | null }[]);

  const projectLine = new Map((projects.data ?? []).map((p) => [p.id as string, p.service_line as string]));
  const perLine = lines.map((l) => {
    const prjCount = (projects.data ?? []).filter((p) => p.service_line === l.code).length;
    const people = new Set((assignments.data ?? []).filter((a) => projectLine.get(a.project_id as string) === l.code).map((a) => a.personnel_id as string)).size;
    return { line: l, projects: prjCount, people };
  });
  const visibleLines = staff ? perLine : perLine.filter((x) => x.projects > 0);
  const totalPeople = new Set((assignments.data ?? []).map((a) => a.personnel_id as string)).size;
  const recent = (messages?.data ?? []) as unknown as MsgRow[];

  return (
    <div className="space-y-6">
      {/* service line cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
        {visibleLines.map(({ line, projects: pc, people }) => (
          <Link
            key={line.code}
            href={staff ? `/projeler?hat=${line.code}` : `/personel/sozlesmeler?hat=${line.code}`}
            className="group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-card transition hover:-translate-y-0.5"
            style={{ background: `linear-gradient(135deg, ${lineColor(line.code)}, color-mix(in oklab, ${lineColor(line.code)} 78%, black))` }}
          >
            <LineIcon name={line.icon} className="size-10 opacity-95" />
            <div>
              <p className="text-lg font-semibold">{line.name} Yönetimi</p>
              <p className="mt-0.5 text-sm text-white/85">{pc} aktif proje · {people} personel</p>
            </div>
            <ArrowRight className="absolute bottom-5 right-5 size-6 transition-transform group-hover:translate-x-1" aria-hidden />
            <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10" />
          </Link>
        ))}
        {visibleLines.length === 0 && (
          <Card className="col-span-full">
            <EmptyState title="Henüz size atanmış bir hizmet alanı yok" description="Merkez projenizi tanımladığında burada görünür." />
          </Card>
        )}
      </div>

      {/* stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {staff && orgs && <Stat label="Toplam Müşteri" value={orgs.count ?? 0} icon={Building2} tone="blue" />}
        <Stat label="Aktif Proje" value={projects.data?.length ?? 0} icon={FolderKanban} tone="emerald" />
        <Stat label="Personel Sayısı" value={totalPeople} icon={Users} tone="violet" />
        <Stat label="Yaklaşan Sözleşme" value={expiring.count ?? 0} hint="60 gün içinde biten projeler" icon={CalendarClock} tone="amber" />
        {!staff && <Stat label="Okunmamış Mesaj" value={counts.unread_threads} icon={MessageSquare} tone="blue" />}
      </div>

      {showRisk && (
        <Card>
          <CardHeader title="Risk Analizi Raporu" description="Merkez tarafından yüklenen güncel risk analizi (PDF)" action={<ShieldAlert className="size-5 text-[var(--tone-rose)]" aria-hidden />} />
          {riskDocs.length === 0 ? (
            <EmptyState title="Henüz risk analizi raporu yüklenmemiş" />
          ) : (
            <ul className="divide-y divide-border">
              {riskDocs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="font-medium">{d.title}</span>
                    <span className="ml-2 text-xs text-muted">{d.projects?.name} · {formatDateTime(d.created_at)}</span>
                  </span>
                  <DownloadLink id={d.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Proje Bazlı Personel Dağılımı" description="Hizmet alanına göre aktif personel" />
          <div className="p-5">
            {totalPeople === 0 ? (
              <EmptyState title="Henüz atanmış personel yok" />
            ) : (
              <Donut
                centerLabel="personel"
                slices={perLine.filter((x) => x.people > 0).map((x) => ({ label: x.line.name, value: x.people, color: lineColor(x.line.code) }))}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Son Mesajlar" action={<Link href="/mesajlar" className="text-sm font-medium text-brand">Tümü</Link>} />
          {recent.length === 0 ? (
            <EmptyState title="Henüz mesaj yok" />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((m) => (
                <li key={m.id}>
                  <Link href={`/mesajlar/${m.thread_id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2">
                    <span
                      className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                      style={{ background: m.sender_kind === "staff" ? "var(--navy)" : "var(--brand)" }}
                      aria-hidden
                    >
                      {m.sender_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toLocaleUpperCase("tr")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium">{m.sender_kind === "staff" ? "Merkez" : (m.threads?.projects?.name ?? m.sender_name)}</span>
                        <span className="shrink-0 text-xs text-muted">{formatDateTime(m.created_at)}</span>
                      </span>
                      <span className="block truncate text-sm text-muted">{m.threads?.subject}: {m.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
