import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export { TASK_STATUS, taskStage, type TaskStage, type TaskStatus } from "@/lib/task-status";

/**
 * Müdürün ilgilenmesi gereken görev sayısı (menüdeki rozet): personelin sorun bildirdiği görevler +
 * personelin "İşi bitirdim" dediği ama henüz "Tamamlandı" yapılmamış görevler. RLS ile yalnızca görebildikleri.
 */
export const openTaskAlerts = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("work_tasks")
    .select("id", { count: "exact", head: true })
    .or("status.eq.issue,and(status.eq.accepted,finished_by_personnel_at.not.is.null)");
  return count ?? 0;
});
