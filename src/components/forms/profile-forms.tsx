"use client";

import { changeOwnPassword } from "@/app/actions/auth";
import { changePasswordSchema } from "@/lib/schemas";
import { Form, PasswordField, SubmitButton } from "@/components/forms/form";

export function ChangePasswordForm() {
  return (
    <Form schema={changePasswordSchema} defaultValues={{ password: "", confirm: "" }} action={changeOwnPassword} className="max-w-md space-y-4 p-5">
      <PasswordField name="password" label="Yeni parola" autoComplete="new-password" required hint="En az 8 karakter" />
      <PasswordField name="confirm" label="Yeni parola (tekrar)" autoComplete="new-password" required />
      <SubmitButton>Parolayı değiştir</SubmitButton>
    </Form>
  );
}
