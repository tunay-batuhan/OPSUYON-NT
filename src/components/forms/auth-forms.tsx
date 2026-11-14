"use client";

import { LockKeyhole, UserRound } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { loginSchema } from "@/lib/schemas";
import { Form, PasswordField, SubmitButton, TextField } from "@/components/forms/form";

/** Giriş formu: büyük kutular, solda simge; yer tutucular örnek gösterir (kullanıcı adı biçimi, parola noktaları). */
export function LoginForm() {
  return (
    <Form schema={loginSchema} defaultValues={{ username: "", password: "" }} action={loginAction} resetOnSuccess={false} className="mt-7 space-y-5">
      <TextField name="username" label="Kullanıcı adı" autoComplete="username" placeholder="ornek.kullanici" icon={UserRound} large required />
      <PasswordField name="password" label="Parola" autoComplete="current-password" placeholder="••••••••" icon={LockKeyhole} large required />
      <SubmitButton size="lg" className="w-full rounded-xl shadow-[0_8px_20px_-8px_color-mix(in_oklab,var(--brand)_70%,transparent)]">Giriş yap</SubmitButton>
    </Form>
  );
}
