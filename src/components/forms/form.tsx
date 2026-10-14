"use client";

import { useId, useState, type ReactNode } from "react";
import {
  FormProvider, useForm, useFormContext,
  type DefaultValues, type FieldValues, type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AlertCircle, CheckCircle2, ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action-types";
import { toTitleCase } from "@/lib/format";
import { btn, cn } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* <Form>: react-hook-form + zod resolver + server action             */
/* ------------------------------------------------------------------ */
export function Form<V extends FieldValues>({
  schema,
  defaultValues,
  action,
  children,
  className,
  resetOnSuccess = true,
  onSuccess,
}: {
  schema: z.ZodType<V, V>;
  defaultValues: DefaultValues<V>;
  action: (values: V) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (result: NonNullable<ActionState>) => void;
}) {
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues, mode: "onTouched" });
  const [result, setResult] = useState<ActionState>(null);

  const submit = form.handleSubmit(async (values) => {
    setResult(null);
    let res: ActionState;
    try {
      res = await action(values);
    } catch (e) {
      // redirect() inside a server action surfaces here as an internal NEXT_REDIRECT error:
      // navigation is already underway, so it must not be shown as a failure.
      const digest = (e as { digest?: unknown })?.digest;
      if ((typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) || (e instanceof Error && e.message === "NEXT_REDIRECT")) return;
      res = { error: e instanceof Error ? e.message : "İşlem tamamlanamadı. Lütfen tekrar deneyin." };
    }
    if (res?.fieldErrors) {
      for (const [name, message] of Object.entries(res.fieldErrors)) form.setError(name as Path<V>, { type: "server", message });
    }
    setResult(res);
    if (res?.ok) {
      if (resetOnSuccess) form.reset(defaultValues);
      onSuccess?.(res);
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className={className}>
        {children}
        {result?.error && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger sm:col-span-full">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{result.error}</span>
          </div>
        )}
        {result?.ok && result.message && (
          <div role="status" className="mt-4 flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success sm:col-span-full">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="select-all whitespace-pre-line">{result.message}</span>
          </div>
        )}
      </form>
    </FormProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Field shell                                                         */
/* ------------------------------------------------------------------ */
type Common = { name: string; label: string; hint?: string; required?: boolean; className?: string; disabled?: boolean };

const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted/60 " +
  "transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:bg-danger-soft/40 aria-invalid:focus:ring-danger/20";

function Shell({
  id, label, hint, required, error, className, children,
}: { id: string; label: string; hint?: string; required?: boolean; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function useField(name: string) {
  const { register, formState } = useFormContext();
  const id = useId();
  const error = (formState.errors[name]?.message as string | undefined) ?? undefined;
  return { id, error, register, invalid: Boolean(error) };
}

export function TextField({
  name, label, hint, required, className, disabled,
  type = "text", placeholder, autoComplete, inputMode, prefix, suffix, maxLength, titleCase,
}: Common & {
  /** Her kelimenin ilk harfini büyütür (alandan çıkınca). */
  titleCase?: boolean;
  type?: "text" | "email" | "tel" | "date" | "number";
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  prefix?: string;
  suffix?: string;
  maxLength?: number;
}) {
  const { id, error, register, invalid } = useField(name);
  const { setValue } = useFormContext();
  const reg = register(name);
  return (
    <Shell id={id} label={label} hint={hint} required={required} error={error} className={className}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted">{prefix}</span>}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn(control, "h-10", prefix && "pl-8", suffix && "pr-9")}
          {...reg}
          onBlur={(e) => {
            if (titleCase && e.target.value) {
              const t = toTitleCase(e.target.value);
              if (t !== e.target.value) setValue(name, t, { shouldDirty: true, shouldValidate: true });
            }
            reg.onBlur(e);
          }}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">{suffix}</span>}
      </div>
    </Shell>
  );
}

export function PasswordField({ name, label, hint, required, className, autoComplete = "current-password", placeholder }: Common & { autoComplete?: string; placeholder?: string }) {
  const { id, error, register, invalid } = useField(name);
  const [show, setShow] = useState(false);
  return (
    <Shell id={id} label={label} hint={hint} required={required} error={error} className={className}>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn(control, "h-10 pr-10")}
          {...register(name)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={show ? "Parolayı gizle" : "Parolayı göster"}
        >
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </Shell>
  );
}

export function SelectField({
  name, label, hint, required, className, disabled, options, placeholder = "Seçin…", onValueChange,
}: Common & { options: { value: string; label: string }[]; placeholder?: string; onValueChange?: (v: string) => void }) {
  const { id, error, register, invalid } = useField(name);
  const reg = register(name);
  return (
    <Shell id={id} label={label} hint={hint} required={required} error={error} className={className}>
      <div className="relative">
        <select
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn(control, "h-10 appearance-none pr-9")}
          {...reg}
          onChange={(e) => {
            reg.onChange(e);
            onValueChange?.(e.target.value);
          }}
        >
          {placeholder !== "" && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted" aria-hidden />
      </div>
    </Shell>
  );
}

export function TextareaField({ name, label, hint, required, className, disabled, placeholder, rows = 3 }: Common & { placeholder?: string; rows?: number }) {
  const { id, error, register, invalid } = useField(name);
  return (
    <Shell id={id} label={label} hint={hint} required={required} error={error} className={className}>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn(control, "py-2")}
        {...register(name)}
      />
    </Shell>
  );
}

export function CheckboxField({ name, label, hint, className }: Omit<Common, "required">) {
  const { id, error, register } = useField(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input id={id} type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" {...register(name)} />
        <span>
          {label}
          {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
        </span>
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function CheckboxGroupField({
  name, label, options, emptyText, className,
}: { name: string; label: string; options: { value: string; label: string }[]; emptyText?: ReactNode; className?: string }) {
  const { register, formState } = useFormContext();
  const error = formState.errors[name]?.message as string | undefined;
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      {options.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2">
              <input type="checkbox" value={o.value} className="size-4 accent-[var(--brand)]" {...register(name)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
}: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; size?: "sm" | "md" | "lg"; className?: string }) {
  const { formState } = useFormContext();
  return (
    <button type="submit" disabled={formState.isSubmitting} className={btn(variant, size, className)}>
      {formState.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Responsive 2/6-column grid that fields can span. */
export function FormGrid({ children, cols = 2, className }: { children: ReactNode; cols?: 2 | 3 | 6; className?: string }) {
  return (
    <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", cols === 6 && "sm:grid-cols-6", className)}>
      {children}
    </div>
  );
}
