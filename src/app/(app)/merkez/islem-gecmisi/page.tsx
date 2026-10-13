import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader, Table, td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

export const metadata: Metadata = { title: "İşlem geçmişi" };

const tableNames: Record<string, string> = {
  organizations: "Firma",
  projects: "Proje",
  profiles: "Kullanıcı",
  project_members: "Proje erişimi",
  member_permission_overrides: "İzin istisnası",
  personnel: "Personel",
  personnel_assignments: "Personel ataması",
  documents: "Belge",
  invoices: "Fatura",
  payments: "Ödeme",
};
const actionTone = { INSERT: "success", UPDATE: "brand", DELETE: "danger" } as const;
const actionLabel = { INSERT: "Eklendi", UPDATE: "Güncellendi", DELETE: "Silindi" } as const;

export default async function AuditPage() {
  await requireStaff("audit.read");
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("id, at, actor_id, action, table_name, record_id").order("at", { ascending: false }).limit(200);
  const logs = (data ?? []) as AuditLog[];

  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.full_name as string]));

  return (
    <>
      <PageHeader title="İşlem geçmişi" description="Son 200 değişiklik. Kayıtlar silinemez ve değiştirilemez." />
      <Card>
        {logs.length === 0 ? (
          <EmptyState title="Kayıt yok" />
        ) : (
          <Table head={["Zaman", "Kullanıcı", "İşlem", "Kayıt türü", "Kayıt"]}>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className={td + " whitespace-nowrap"}>{formatDateTime(l.at)}</td>
                <td className={td}>{l.actor_id ? (names.get(l.actor_id) ?? "—") : "Sistem"}</td>
                <td className={td}><Badge tone={actionTone[l.action]}>{actionLabel[l.action]}</Badge></td>
                <td className={td}>{tableNames[l.table_name] ?? l.table_name}</td>
                <td className={td + " font-mono text-xs text-muted"}>{l.record_id?.slice(0, 8)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
