"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Sunucu formu için gönder düğmesi: önce onay sorar (silme gibi geri alınamayan işler). */
export function ConfirmSubmit({ message, children, className, label }: { message: string; children: ReactNode; className?: string; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      aria-label={label}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
