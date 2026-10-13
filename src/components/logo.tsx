import Link from "next/link";
import { cn } from "@/components/ui";

export function Logo({ className, href = "/", dark = false }: { className?: string; href?: string; dark?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", dark && "text-white", className)}>
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 text-sm font-bold text-white shadow-sm"
      >
        O
      </span>
      <span className="text-lg">
        OPS<span className={dark ? "text-teal-300" : "text-brand"}>U</span>YON
      </span>
    </Link>
  );
}
