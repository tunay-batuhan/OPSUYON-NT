"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react";
import { btn, cn } from "@/components/ui";
import { submitContactMessage } from "@/app/actions/contact";
import {
  CONTACT_LIMITS, CONTACT_TOPICS, contactFieldErrors, contactValuesFrom, type ContactState, type ContactValues,
} from "@/lib/schemas-contact";

/** components/forms/form.tsx'teki alan görünümü (o modül react-hook-form'u da yüklediği için kopyalandı). */
const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-base sm:text-sm text-fg placeholder:text-muted/60 " +
  "transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:bg-danger-soft/40 aria-invalid:focus:ring-danger/20";

type Errors = Partial<Record<keyof ContactValues, string>>;
const ORDER: (keyof ContactValues)[] = ["full_name", "company", "email", "phone", "topic", "message", "kvkk"];

function Field({
  id, label, required, error, hint, children,
}: { id: string; label: string; required?: boolean; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {required ? <span aria-hidden className="ml-0.5 text-danger">*</span> : <span className="ml-1 font-normal text-muted">(isteğe bağlı)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * İletişim formu. Sunucu işlemi (useActionState) JavaScript olmadan da çalışır; JavaScript varsa aynı şema
 * gönderimden önce tarayıcıda denetlenir ve hatalar alanların altında gösterilir.
 * `stamp`: sunucunun imzaladığı form damgası (en az 3 sn sonra gönderilebilir).
 */
export function ContactForm({ stamp, defaultTopic }: { stamp: string; defaultTopic?: string }) {
  const [state, formAction, pending] = useActionState(submitContactMessage, null as ContactState);
  const [clientErrors, setClientErrors] = useState<Errors | null>(null);
  const [hidden, setHidden] = useState<ContactState>(null); // "Yeni mesaj yaz" sonrası başarı kutusu gizlenir
  const [length, setLength] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const errors: Errors = clientErrors ?? state?.fieldErrors ?? {};
  const v = state?.values;
  const success = Boolean(state?.ok) && state !== hidden;

  // Sunucudan hata dönünce ilk hatalı alana (yoksa hata kutusuna) odaklan; başarıda başarı kutusuna.
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      statusRef.current?.focus();
      return;
    }
    const first = ORDER.find((k) => state.fieldErrors?.[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    else statusRef.current?.focus();
  }, [state]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const found = contactFieldErrors(contactValuesFrom(new FormData(e.currentTarget)));
    if (found) {
      e.preventDefault();
      setClientErrors(found);
      const first = ORDER.find((k) => found[k]);
      if (first) e.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setClientErrors(null);
  }

  if (success) {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="rounded-2xl border border-success/30 bg-success-soft p-6 text-success focus:outline-none">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="size-6" aria-hidden /> Mesajınız bize ulaştı
        </p>
        <p className="mt-2 text-sm text-fg/80">
          Teşekkür ederiz. Talebinizi inceleyip verdiğiniz iletişim bilgileri üzerinden en kısa sürede size dönüş yapacağız.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/" className={btn("secondary", "md")}>Ana sayfaya dönün</Link>
          <button type="button" onClick={() => { setHidden(state); setLength(0); }} className={btn("ghost", "md")}>Yeni mesaj yazın</button>
        </div>
      </div>
    );
  }

  const described = (name: keyof ContactValues, hint = false) => (errors[name] ? `${name}-err` : hint ? `${name}-hint` : undefined);
  const inv = (name: keyof ContactValues) => (errors[name] ? true : undefined);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="space-y-5" aria-describedby="form-required-note">
      <p id="form-required-note" className="text-sm text-muted">
        <span aria-hidden className="text-danger">*</span> ile işaretli alanlar zorunludur.
      </p>

      {state?.error && (
        <div ref={statusRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger focus:outline-none">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <input type="hidden" name="stamp" value={state?.stamp ?? stamp} />
      {/* Gizli alan (honeypot): insanlar görmez, ekran okuyucular atlar; botlar doldurur. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-auto size-px overflow-hidden">
        <label htmlFor="website">Web siteniz (bu alanı boş bırakın)</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="full_name" label="Ad soyad" required error={errors.full_name}>
          <input
            id="full_name" name="full_name" type="text" autoComplete="name" autoCapitalize="words" maxLength={CONTACT_LIMITS.name} required
            defaultValue={v?.full_name ?? ""} aria-invalid={inv("full_name")} aria-describedby={described("full_name")} className={cn(control, "h-11")}
          />
        </Field>
        <Field id="company" label="Firma" error={errors.company}>
          <input
            id="company" name="company" type="text" autoComplete="organization" maxLength={CONTACT_LIMITS.company}
            defaultValue={v?.company ?? ""} aria-invalid={inv("company")} aria-describedby={described("company")} className={cn(control, "h-11")}
          />
        </Field>
        <Field id="email" label="E-posta" required error={errors.email}>
          <input
            id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={CONTACT_LIMITS.email} required spellCheck={false}
            defaultValue={v?.email ?? ""} aria-invalid={inv("email")} aria-describedby={described("email")} className={cn(control, "h-11")}
          />
        </Field>
        <Field id="phone" label="Telefon" error={errors.phone} hint="Örn. 0532 123 45 67">
          <input
            id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={CONTACT_LIMITS.phone}
            defaultValue={v?.phone ?? ""} aria-invalid={inv("phone")} aria-describedby={described("phone", true)} className={cn(control, "h-11")}
          />
        </Field>
      </div>

      <Field id="topic" label="Konu" required error={errors.topic}>
        <div className="relative">
          {/* key: React, form sıfırlanırken <select>'in varsayılanını güncellemez; dönen değerle yeniden kurulur */}
          <select
            key={`topic-${v?.topic ?? "ilk"}`}
            id="topic" name="topic" required defaultValue={v?.topic ?? (defaultTopic && defaultTopic in CONTACT_TOPICS ? defaultTopic : "")}
            aria-invalid={inv("topic")} aria-describedby={described("topic")} className={cn(control, "h-11 appearance-none pr-9")}
          >
            <option value="">Seçin…</option>
            {Object.entries(CONTACT_TOPICS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted" aria-hidden />
        </div>
      </Field>

      <Field
        id="message" label="Mesajınız" required error={errors.message}
        hint={<>Projeniz, hizmet alanı ve personel sayısı gibi bilgiler hızlı dönüş yapmamıza yardımcı olur. <span className="tabular-nums">({length}/{CONTACT_LIMITS.message})</span></>}
      >
        <textarea
          id="message" name="message" rows={6} required minLength={CONTACT_LIMITS.messageMin} maxLength={CONTACT_LIMITS.message}
          defaultValue={v?.message ?? ""} onInput={(e) => setLength(e.currentTarget.value.length)}
          aria-invalid={inv("message")} aria-describedby={described("message", true)} className={cn(control, "py-2.5")}
        />
      </Field>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="kvkk" name="kvkk" type="checkbox" required defaultChecked={v?.kvkk ?? false}
            aria-invalid={inv("kvkk")} aria-describedby={errors.kvkk ? "kvkk-err" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
          />
          <label htmlFor="kvkk" className="text-sm leading-relaxed text-fg">
            Kişisel verilerimin bu talebi yanıtlamak amacıyla işlenmesine ilişkin{" "}
            <Link href="/kvkk-aydinlatma-metni" target="_blank" rel="noopener" className="font-medium text-brand underline underline-offset-2 hover:text-brand-hover">
              KVKK Aydınlatma Metni<span className="sr-only"> (yeni sekmede açılır)</span>
            </Link>
            ’ni okudum.<span aria-hidden className="ml-0.5 text-danger">*</span>
          </label>
        </div>
        {errors.kvkk && (
          <p id="kvkk-err" className="mt-1.5 flex items-center gap-1 pl-8 text-xs font-medium text-danger">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {errors.kvkk}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className={btn("primary", "lg", "w-full sm:w-auto")}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
        {pending ? "Gönderiliyor…" : "Mesajı gönder"}
      </button>
    </form>
  );
}
