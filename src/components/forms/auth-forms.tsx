"use client";

import { loginAction } from "@/app/actions/auth";
import { loginSchema } from "@/lib/schemas";
import { Form, PasswordField, SubmitButton, TextField } from "@/components/forms/form";

export function LoginForm() {
  return (
    <Form schema={loginSchema} defaultValues={{ username: "", password: "" }} action={loginAction} resetOnSuccess={false} className="mt-6 space-y-4">
      <TextField name="username" label="Kullanıcı adı" autoComplete="username" placeholder="Size iletilen kullanıcı adı" required />
      <PasswordField name="password" label="Parola" autoComplete="current-password" required />
      <SubmitButton size="lg" className="w-full">Giriş yap</SubmitButton>
    </Form>
  );
}
