import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Tabs, type TabItem } from "@/components/tabs";
import { Badge, PageHeader, lineColor } from "@/components/ui";
import { can, getProjectContext } from "@/lib/project";
import { getCurrentUser } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { getServiceLines } from "@/lib/lines";

const statusLabel = { active: "Aktif", paused: "Duraklatıldı", closed: "Pasif" } as const;
const statusTone = { active: "success", paused: "warning", closed: "neutral" } as const;

export default async function ProjectLayout({ children, params }: LayoutProps<"/projeler/[id]">) {
  const { id } = await params;
  await requireModule("projeler");
  const [ctx, user, lines] = await Promise.all([getProjectContext(id), getCurrentUser(), getServiceLines()]);
  const { project } = ctx;
  const line = lines.find((l) => l.code === project.service_line);
  const base = `/projeler/${id}`;

  const hasAnyDocs = ["personnel.files.read", "contracts.read", "payroll.read", "timesheets.read", "leaves.read", "invoices.read", "payments.read", "documents.read", "documents.manage"].some((p) => can(ctx, p));
  const hasFinance = ["ledger.read", "finance.manage"].some((p) => can(ctx, p));

  const tabs: TabItem[] = [{ href: base, label: "Genel", exact: true }];
  if (can(ctx, "personnel.read")) tabs.push({ href: `${base}/personel`, label: "Personel" });
  if (can(ctx, "timesheets.read")) tabs.push({ href: `${base}/puantaj`, label: "Puantaj" });
  if (can(ctx, "leaves.read")) tabs.push({ href: `${base}/izinler`, label: "Yıllık izin" });
  if (hasAnyDocs) tabs.push({ href: `${base}/belgeler`, label: "Belgeler" });
  if (hasFinance) tabs.push({ href: `${base}/finans`, label: "Cari hesap" });
  if (can(ctx, "imports.manage")) tabs.push({ href: `${base}/aktar`, label: "Excel aktar" });
  if (can(ctx, "messages.use") || can(ctx, "messages.manage")) tabs.push({ href: `${base}/mesajlar`, label: "Yazışma" });

  const backHref = user?.kind === "staff" ? "/merkez/projeler" : "/panel";

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Link href={backHref} className="hover:text-fg">
              {user?.kind === "staff" ? "Projeler" : "Projelerim"}
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span>{project.organizations?.name}</span>
          </span>
        }
        title={project.name}
        description={project.address ?? undefined}
        actions={
          <>
            {line && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ background: lineColor(line.code) }}
              >
                {line.name}
              </span>
            )}
            <Badge tone={statusTone[project.status]}>{statusLabel[project.status]}</Badge>
          </>
        }
      />
      <Tabs items={tabs} />
      {children}
    </>
  );
}
