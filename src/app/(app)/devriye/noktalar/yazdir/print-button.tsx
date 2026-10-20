"use client";

import { Printer } from "lucide-react";
import { btn } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btn("primary", "md")}>
      <Printer className="size-4" aria-hidden /> Yazdır
    </button>
  );
}
