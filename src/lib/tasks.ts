import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireAccess } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

export { TASK_STATUS, taskStage, type TaskStage, type TaskStatus } from "@/lib/task-status";

/**
 * İş Planlama sayfalarına giriş. Merkez kullanıcısı her zaman girer: saha görevlerini görme yetkisi (tasks.read)
 * olmasa da kendisine atanan merkez görevlerini görür (satırları RLS süzer). Müşteri: modül açık + tasks.read.
 */
export async function requireTaskAccess() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.kind === "staff") return user;
  return requireAccess("is_planlama", "tasks.read");
}

/**
 * İlgilenilmesi gereken görev sayısı (menüdeki rozet). Görevi verenin gözünden: görevi alanın sorun bildirdiği +
 * "İşi bitirdim" dediği ama henüz "Tamamlandı" yapılmamış görevler (RLS ile yalnızca görebildikleri).
 * Merkez kullanıcısında ayrıca: kendisine atanmış, yanıtını bekleyen görevler (`userId` verilirse).
 */
export const openTaskAlerts = cache(async (userId?: string): Promise<number> => {
  const supabase = await createClient();
  const [watch, mine] = await Promise.all([
    supabase
      .from("work_tasks")
      .select("id", { count: "exact", head: true })
      .or("status.eq.issue,and(status.eq.accepted,finished_by_personnel_at.not.is.null)"),
    // ayrı sorgu: sütun veritabanında henüz yoksa yalnızca bu sayı 0 olur
    userId ? supabase.from("work_tasks").select("id", { count: "exact", head: true }).eq("assignee_id", userId).eq("status", "pending") : Promise.resolve({ count: 0 }),
  ]);
  return (watch.count ?? 0) + (mine.count ?? 0);
});
