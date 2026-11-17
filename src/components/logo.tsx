import Link from "next/link";
import { cn } from "@/components/ui";
import { BRAND, BRAND_WORD } from "@/lib/brand";
import { LOGO_GRADIENT, LOGO_RING, LOGO_SHAPES, LOGO_VIEWBOX } from "@/lib/logo-art";

/**
 * Circular mark: blue gradient ring, three people, yellow arrow rising across the ring. Acts as the "O".
 * Geometry lives ONLY in src/lib/logo-art.ts (single source for the app, favicon, OG image and brand files).
 */
/**
 * `gradientId`: aynı sayfada gizlenebilen (display:none) bir logo varsa ona AYRI bir kimlik verin. Gizli SVG'deki
 * gradyana başvuran diğer logoların halkası çizilmez (ilk eşleşen kimlik kullanılır).
 */
export function LogoMark({ className, gradientId = "lm-ring" }: { className?: string; gradientId?: string }) {
  const g = LOGO_GRADIENT;
  return (
    <svg viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} gradientUnits="userSpaceOnUse">
          {g.stops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      </defs>
      <circle cx={LOGO_RING.cx} cy={LOGO_RING.cy} r={LOGO_RING.r} fill="none" stroke={`url(#${gradientId})`} strokeWidth={LOGO_RING.strokeWidth} />
      {LOGO_SHAPES.map((sh, i) =>
        sh.kind === "circle" ? (
          <circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill={sh.fill} stroke={sh.stroke} strokeWidth={sh.strokeWidth} />
        ) : (
          <path
            key={i}
            d={sh.d}
            fill={sh.fill ?? "none"}
            stroke={sh.stroke}
            strokeWidth={sh.strokeWidth}
            strokeLinecap={sh.cap}
            strokeLinejoin={sh.join}
          />
        ),
      )}
    </svg>
  );
}

export function Logo({
  className, href = "/", dark = false, size = "md", gradientId,
}: { className?: string; href?: string; dark?: boolean; size?: "sm" | "md" | "lg"; gradientId?: string }) {
  return (
    <Link href={href} aria-label={BRAND} className={cn("inline-flex items-center font-extrabold tracking-tight", className)}>
      <span className={cn("grid place-items-center rounded-full", dark && "bg-white", size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-10")}>
        <LogoMark gradientId={gradientId} className={size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-10"} />
      </span>
      {/* işaret "O" harfidir; "PSUYON" ile arasında küçük bir nefes payı bırakılır (bitişik durmasın) */}
      <span aria-hidden className={cn(dark ? "text-white" : "text-navy", size === "lg" ? "ml-0.5 text-4xl" : size === "sm" ? "ml-0.5 text-lg" : "ml-1 text-2xl")}>
        {BRAND_WORD}
      </span>
    </Link>
  );
}
