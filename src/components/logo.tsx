import Link from "next/link";
import { cn } from "@/components/ui";
import { BRAND, BRAND_WORD } from "@/lib/brand";

/** Circular mark from the reference: navy/blue ring, person, yellow swoosh arrow. Acts as the "O". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id="lm-ring" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a2a63" />
          <stop offset="0.55" stopColor="#1f6fe5" />
          <stop offset="1" stopColor="#0a2a63" />
        </linearGradient>
      </defs>
      <circle cx="33" cy="31" r="23" fill="none" stroke="url(#lm-ring)" strokeWidth="8" />
      <circle cx="33" cy="25" r="6.5" fill="#1f6fe5" />
      <path d="M21 43c0-7.4 5.4-11.5 12-11.5S45 35.6 45 43v1H21v-1Z" fill="#0a2a63" />
      <path d="M5 40c3 12 13 19 26 19" fill="none" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M26 53.5 33 59l-9 1.5" fill="none" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({
  className, href = "/", dark = false, size = "md",
}: { className?: string; href?: string; dark?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <Link href={href} aria-label={BRAND} className={cn("inline-flex items-center font-extrabold tracking-tight", className)}>
      <span className={cn("grid place-items-center rounded-full", dark && "bg-white", size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-10")}>
        <LogoMark className={size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-10"} />
      </span>
      <span aria-hidden className={cn("-ml-1", dark ? "text-white" : "text-navy", size === "lg" ? "text-4xl" : size === "sm" ? "text-lg" : "text-2xl")}>
        {BRAND_WORD}
      </span>
    </Link>
  );
}
