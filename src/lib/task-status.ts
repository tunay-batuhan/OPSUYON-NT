/** İş Planlama: görev durumları (veritabanı: work_tasks.status). İstemci bileşenleri de kullanır. */
export type TaskStatus = "pending" | "issue" | "accepted" | "done" | "cancelled";

/**
 * Ekranda gösterilen aşama: "accepted" durumundaki görev tarih verildiyse Planlanan, verilmediyse Tarih bekliyor;
 * personel "İşi bitirdim" dediyse Onayınızı bekliyor.
 */
export type TaskStage = "pending" | "issue" | "waiting_date" | "planned" | "finished" | "done" | "cancelled";

export const TASK_STATUS: Record<TaskStage, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger"; hint: string }> = {
  pending: { label: "Onay bekliyor", tone: "warning", hint: "Personel henüz kabul etmedi" },
  issue: { label: "Sorun bildirildi", tone: "danger", hint: "Personel açıklama yazdı; düzeltip yeniden gönderin" },
  waiting_date: { label: "Tarih bekliyor", tone: "brand", hint: "Personel kabul etti; tarih ve saat verin" },
  planned: { label: "Planlandı", tone: "brand", hint: "Tarih ve saat belli" },
  finished: { label: "Personel bitirdi", tone: "success", hint: "Personel işi bitirdiğini bildirdi; Tamamlandı ile kapatın" },
  done: { label: "Tamamlandı", tone: "success", hint: "İş kapatıldı" },
  cancelled: { label: "İptal", tone: "neutral", hint: "Görev iptal edildi" },
};

export function taskStage(t: { status: string; planned_date: string | null; finished_by_personnel_at?: string | null }): TaskStage {
  switch (t.status) {
    case "pending":
      return "pending";
    case "issue":
      return "issue";
    case "accepted":
      return t.finished_by_personnel_at ? "finished" : t.planned_date ? "planned" : "waiting_date";
    case "done":
      return "done";
    default:
      return "cancelled";
  }
}

/**
 * Aşama etiketi ve açıklaması. Merkez görevinde (görev bir merkez kullanıcısına atanmışsa) "Personel" yerine
 * "Görevli" yazar.
 */
export function stageInfo(stage: TaskStage, staffTask = false) {
  const s = TASK_STATUS[stage];
  if (!staffTask) return s;
  return { ...s, label: s.label.replace("Personel", "Görevli"), hint: s.hint.replace(/Personel/g, "Görevli") };
}
