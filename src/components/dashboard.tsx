import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, FolderKanban, MessageSquare, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, LineIcon, Stat, lineColor } from "@/components/ui";
import { Donut } from "@/components/donut";
import { canAnywhere, type CurrentUser } from "@/lib/auth";
import { getServiceLines, lineTitle } from "@/lib/lines";
import { getNotificationCounts } from "@/lib/notifications";
import { getEnabledModules } from "@/lib/modules";
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
  const showExpiring = staff || enabled.has("yaklasan_sozlesme");
  const [lines, projects, assignments, orgs, messages, counts] = await Promise.all([
    getServiceLines(),
    supabase.from("projects").select("id, name, service_line, status, end_date"),
    supabase.from("personnel_assignments").select("personnel_id, project_id").is("end_date", null),
    staff && canAnywhere(user, "organizations.read") ? supabase.from("organizations").select("id", head).eq("status", "active") : null,
    canAnywhere(user, "messages.use") || canAnywhere(user, "messages.manage")
      ? supabase.from("messages").select("id, body, sender_name, sender_kind, created_at, thread_id, threads(subject, projects(name))").order("created_at", { ascending: false }).limit(4)
      : null,
    getNotificationCounts(),
  ]);

  // getServiceLines yalnızca aktif hatları döner; pasif hattaki (ör. Kurumsal Tedarik) projeler hiçbir sayıya girmez.
  type Prj = { id: string; name: string; service_line: string; status: string; end_date: string | null };
  const activeCodes = new Set(lines.map((l) => l.code));
  const allProjects = (projects.data ?? []) as Prj[];
  const lineOf = new Map(allProjects.map((p) => [p.id, p.service_line]));
  const live = allProjects.filter((p) => p.status === "active" && activeCodes.has(p.service_line));
  const liveIds = new Set(live.map((p) => p.id));
  const assigned = ((assignments.data ?? []) as { personnel_id: string; project_id: string }[]).filter((a) => activeCodes.has(lineOf.get(a.project_id) ?? ""));
  const expiring = live.filter((p) => p.end_date && p.end_date >= today && p.end_date <= soon).length;

  const perLine = lines.map((l) => {
    const linePrj = live.filter((p) => p.service_line === l.code);
    const people = new Set(assigned.filter((a) => liveIds.has(a.project_id) && lineOf.get(a.project_id) === l.code).map((a) => a.personnel_id)).size;
    // Müşteri menüsünde "Projeler" yok: kartta hangi projelerin tanımlı olduğu görünsün
    return { line: l, projects: linePrj.length, people, names: linePrj.map((p) => p.name) };
  });
  const visibleLines = staff ? perLine : perLine.filter((x) => x.projects > 0);
  const totalPeople = new Set(assigned.map((a) => a.personnel_id)).size;
  const recent = (messages?.data ?? []) as unknown as MsgRow[];

  return (
    <div className="space-y-6">
      {/* service line cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
        {visibleLines.map(({ line, projects: pc, people, names }) => (
          <Link
            key={line.code}
            href={staff ? `/merkez/projeler?hat=${line.code}` : `/personel?hat=${line.code}`}
            className="group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-card transition hover:-translate-y-0.5"
            style={{ background: `linear-gradient(135deg, ${lineColor(line.code)}, color-mix(in oklab, ${lineColor(line.code)} 78%, black))` }}
          >
            <LineIcon name={line.icon} className="size-10 opacity-95" />
            <div>
              <p className="text-lg font-semibold">{lineTitle(line.name)}</p>
              <p className="mt-0.5 text-sm text-white/85">{pc} aktif proje · {people} personel</p>
              {!staff && names.length > 0 && (
                <p className="mt-1 line-clamp-2 text-xs text-white/75" title={names.join(", ")}>{names.join(" · ")}</p>
              )}
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
        <Stat label="Aktif Proje" value={live.length} icon={FolderKanban} tone="emerald" />
        <Stat label="Personel Sayısı" value={totalPeople} icon={Users} tone="violet" />
        {showExpiring && <Stat label="Yaklaşan Sözleşme" value={expiring} hint="60 gün içinde biten projeler" icon={CalendarClock} tone="amber" />}
        {!staff && <Stat label="Okunmamış Mesaj" value={counts.unread_threads} icon={MessageSquare} tone="blue" />}
      </div>

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
