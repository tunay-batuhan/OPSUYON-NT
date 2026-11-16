"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/action-types";

/** Sunucu işlemini çalıştırır; sonucu (hata / bilgi) tutar ve başarıda sayfayı tazeler. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>(null);
  const run = (fn: () => Promise<ActionState>, after?: (r: NonNullable<ActionState>) => void) =>
    start(async () => {
      setResult(null);
      let res: ActionState;
      try {
        res = await fn();
      } catch (e) {
        res = { error: e instanceof Error ? e.message : "İşlem tamamlanamadı. Lütfen tekrar deneyin." };
      }
      setResult(res);
      if (res?.ok) {
        after?.(res);
        router.refresh();
      }
    });
  return { pending, result, setResult, run };
}
