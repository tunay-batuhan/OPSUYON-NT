import clsx from "clsx";
import type React from "react";
import type { ReactNode } from "react";
import { Briefcase, ShieldCheck, Sparkles, Building2, type LucideIcon } from "lucide-react";

export const cn = clsx;

/* ------------------------------------------------------------------ */
/* Service line visuals                                                */
/* ------------------------------------------------------------------ */
const lineIcons: Record<string, LucideIcon> = {
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  briefcase: Briefcase,
};
export function LineIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && lineIcons[name]) || Building2;
  return <Icon className={className} aria-hidden />;
}
export const lineColor = (code?: string | null) => `var(--line-${code ?? "kurumsal_tedarik"}, var(--brand))`;

/* ------------------------------------------------------------------ */
/* Buttons / inputs (class helpers, usable on <a>, <Link>, <button>)    */
/* ------------------------------------------------------------------ */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function btn(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-base",
    variant === "primary" && "bg-brand text-brand-fg hover:bg-brand-hover",
    variant === "secondary" && "border border-border bg-surface text-fg hover:bg-surface-2",
    variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
    variant === "danger" && "bg-danger-soft text-danger hover:brightness-95",
    extra,
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted/70 " +
  "focus:border-brand focus:outline-none disabled:opacity-60";
export const textareaCls = inputCls.replace("h-10", "min-h-24 py-2");

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Layout bits                                                         */
/* ------------------------------------------------------------------ */
export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-6 rounded-2xl border border-border bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface-2/60 px-5 py-4 first:rounded-t-2xl">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm text-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-surface-2 text-muted",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "success" && "bg-success-soft text-success",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-danger-soft text-danger",
      )}
    >
      {children}
    </span>
  );
}

export type AccentTone = "teal" | "blue" | "violet" | "amber" | "rose" | "emerald";
export const accent = (tone: AccentTone) =>
  ({ ["--a" as string]: `var(--tone-${tone})`, ["--a-soft" as string]: `var(--tone-${tone}-soft)` }) as React.CSSProperties;

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: AccentTone;
}) {
  return (
    <Card className="relative overflow-hidden p-5" >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `var(--tone-${tone})` }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {Icon && (
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl"
            style={{ background: `var(--tone-${tone}-soft)`, color: `var(--tone-${tone})` }}
            aria-hidden
          >
            <Icon className="size-5" />
          </span>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "warning", children }: { tone?: "warning" | "danger" | "success" | "brand"; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "success" && "bg-success-soft text-success",
        tone === "brand" && "bg-brand-soft text-brand",
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */
export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-muted">
            {head.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-5 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-5 py-3 align-middle";
export const tdNum = "px-5 py-3 text-right tabular-nums";
