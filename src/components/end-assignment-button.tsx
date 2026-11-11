"use client";

import { useState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { endAssignment } from "@/app/actions/personnel";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * "Görevden al": onay penceresi açar, aktif atamayı sonlandırır (görev henüz başlamadıysa iptal eder) ve sonucu
 * satırın altında gösterir. Hata asla sessiz kalmaz. Satır listede kalıyorsa (Tümü filtresi, personel kartı) başarı
 * mesajı da görünür; "Aktif" listesinde satır çıkar ve sayaçlar güncellenir.
 */
export function EndAssignmentButton({
  id, name, project, upcoming = false, startLabel, ended = false,
}: {
  id: string;
  /** Personelin adı (onay sorusunda) */
  name: string;
  /** Proje adı; verilirse soruda "… projesinden" yazılır (personel detayı gibi proje dışı ekranlar için) */
  project?: string;
  /** Görev başlangıcı ileri bir tarihte mi (sunucuda Türkiye gününe göre hesaplanır) */
  upcoming?: boolean;
  /** Atama zaten sonlanmış: düğme gösterilmez; yalnızca az önceki işlemin sonucu (varsa) kalır */
  ended?: boolean;
  /** Başlangıç tarihi (gösterim için, ör. "15.11.2026") */
  startLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const message = result && (
    <p
      role={result.ok ? "status" : "alert"}
      className={result.ok ? "mt-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 text-xs text-success" : "mt-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger"}
    >
      {result.text}
    </p>
  );
  // Sonlanmış atama: düğme yok; bu satırda az önce yapılan işlemin sonucu (sayfa yenilenince de satır kalıyorsa) görünür
  if (ended) return message ? <div className="max-w-xs">{message}</div> : null;

  return (
    <div className="max-w-xs">
      <ConfirmDialog
        title={project ? `${name} adlı personel “${project}” projesinden çıkarılsın mı?` : `${name} adlı personel bu projeden çıkarılsın mı?`}
        description={
          upcoming
            ? `Görev henüz başlamadı${startLabel ? ` (başlangıç ${startLabel})` : ""}; atama kaydı iptal edilir (silinir). Personel kendi firmasının başka bir projesine atanabilir.`
            : "Görev bugünün tarihiyle sonlandırılır, kayıt geçmişte “Ayrıldı” olarak kalır. Personel kendi firmasının başka bir projesine atanabilir."
        }
        confirmLabel={upcoming ? "Atamayı iptal et" : "Görevden al"}
        tone="warning"
        onConfirm={async () => {
          setBusy(true);
          setResult(null);
          try {
            const res = await endAssignment({ id });
            if (res?.error) setResult({ ok: false, text: res.error });
            else setResult({ ok: true, text: res?.message ?? "Görevden alındı." });
          } catch (e) {
            setResult({ ok: false, text: e instanceof Error ? e.message : "Görevden alınamadı. Bağlantınızı kontrol edip tekrar deneyin." });
          } finally {
            setBusy(false);
          }
        }}
      >
        <button
          type="button"
          disabled={busy}
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-danger hover:underline disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserMinus className="size-4" aria-hidden />}
          Görevden al
        </button>
      </ConfirmDialog>
      {message}
    </div>
  );
}
