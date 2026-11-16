import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionState } from "@/lib/action-types";
import { cn } from "@/components/ui";

/** İşlem sonucu satırı (hata kırmızı, bilgi yeşil). */
export function ActionResult({ result, className }: { result: ActionState; className?: string }) {
  if (!result || (!result.error && !result.message)) return null;
  const err = Boolean(result.error);
  return (
    <div
      role={err ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm", err ? "bg-danger-soft text-danger" : "bg-success-soft text-success", className)}
    >
      {err ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span className="whitespace-pre-line">{result.error ?? result.message}</span>
    </div>
  );
}
