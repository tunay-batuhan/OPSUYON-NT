import Link from "next/link";
import { cn } from "@/components/ui";
import { BRAND, BRAND_WORD } from "@/lib/brand";
import { LOGO_ARROW, LOGO_BODY, LOGO_GRADIENT, LOGO_HEAD, LOGO_RING, LOGO_VIEWBOX } from "@/lib/logo-art";

/**
 * Circular mark from the reference: navy/blue ring, person, yellow swoosh arrow. Acts as the "O".
 * Geometry lives ONLY in src/lib/logo-art.ts (single source for the app, favicon, OG image and brand files).
 */
export function LogoMark({ className }: { className?: string }) {
  const g = LOGO_GRADIENT;
  return (
    <svg viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id="lm-ring" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} gradientUnits="userSpaceOnUse">
          {g.stops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      </defs>
      <circle cx={LOGO_RING.cx} cy={LOGO_RING.cy} r={LOGO_RING.r} fill="none" stroke="url(#lm-ring)" strokeWidth={LOGO_RING.strokeWidth} />
      <circle cx={LOGO_HEAD.cx} cy={LOGO_HEAD.cy} r={LOGO_HEAD.r} fill={LOGO_HEAD.fill} />
      <path d={LOGO_BODY.d} fill={LOGO_BODY.fill} />
      {LOGO_ARROW.paths.map((p) => (
        <path
          key={p.d}
          d={p.d}
          fill="none"
          stroke={LOGO_ARROW.stroke}
          strokeWidth={LOGO_ARROW.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin={p.round ? "round" : undefined}
        />
      ))}
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
      {/* işaret "O" harfidir; "PSÜYON" ile arasında küçük bir nefes payı bırakılır (bitişik durmasın) */}
      <span aria-hidden className={cn(dark ? "text-white" : "text-navy", size === "lg" ? "ml-0.5 text-4xl" : size === "sm" ? "ml-0.5 text-lg" : "ml-1 text-2xl")}>
        {BRAND_WORD}
      </span>
    </Link>
  );
}
