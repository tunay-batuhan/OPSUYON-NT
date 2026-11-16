"use client";

import { useRouter } from "next/navigation";
import { changeOwnPassword } from "@/app/actions/auth";
import { changePasswordSchema } from "@/lib/schemas";
import { Form, PasswordField, SubmitButton } from "@/components/forms/form";

/** Personel parolası: ilk girişte belirlenince Görevlerim'e geçer. Telefonda büyük kutular. */
export function PersonnelPasswordForm({ first }: { first: boolean }) {
  const router = useRouter();
  return (
    <Form
      schema={changePasswordSchema}
      defaultValues={{ password: "", confirm: "" }}
      action={changeOwnPassword}
      onSuccess={() => {
        if (first) router.replace("/gorevlerim");
        else router.refresh();
      }}
      className="mt-4 space-y-4"
    >
      <PasswordField name="password" label="Yeni parola" autoComplete="new-password" required hint="En az 8 karakter" large />
      <PasswordField name="confirm" label="Yeni parola (tekrar)" autoComplete="new-password" required large />
      <SubmitButton size="lg" className="w-full rounded-xl">{first ? "Parolamı kaydet ve devam et" : "Parolayı değiştir"}</SubmitButton>
    </Form>
  );
}
