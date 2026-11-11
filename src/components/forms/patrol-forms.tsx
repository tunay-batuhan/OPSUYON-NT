"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { addPatrolPoints, renamePatrolPoint } from "@/app/actions/patrol";
import { patrolPointsBulkSchema } from "@/lib/schemas";
import { Form, SubmitButton, TextareaField } from "@/components/forms/form";
import { cn, inputCls } from "@/components/ui";

/** Merkez: seçili projeye nokta ekler; her satır bir nokta adı (QR içeriği otomatik üretilir). */
export function PatrolPointsAddForm({ projectId }: { projectId: string }) {
  return (
    <Form schema={patrolPointsBulkSchema} defaultValues={{ project_id: projectId, names: "" }} action={addPatrolPoints} className="space-y-3 p-5">
      <TextareaField
        name="names"
        label="Nokta adları"
        rows={4}
        placeholder={"A Blok Girişi\nOtopark -1\nYangın Merdiveni"}
        hint="Her satıra bir nokta adı yazın; birden çok satır yazarak hepsini birlikte ekleyebilirsiniz. “Devriye başlat / bitir” etiketi kendiliğinden oluşur, onu eklemeyin."
      />
      <SubmitButton>
        <Plus className="size-4" aria-hidden /> Noktaları ekle
      </SubmitButton>
    </Form>
  );
}

/** Nokta adı: kalem simgesiyle satırda düzenlenir (Enter kaydeder, Esc vazgeçer). QR kodu değişmez. */
export function PatrolPointName({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cancel = () => {
    setEditing(false);
    setValue(name);
    setError(null);
  };
  const save = () => {
    if (value.trim() === name) return cancel();
    start(async () => {
      const res = await renamePatrolPoint(id, value);
      if ("error" in res) setError(res.error);
      else {
        setEditing(false);
        setError(null);
      }
    });
  };

  if (!editing) {
    return (
      <span className="group inline-flex items-center gap-1.5">
        <span className="font-medium">{name}</span>
        <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted opacity-60 hover:bg-surface-2 hover:text-fg group-hover:opacity-100" aria-label={`${name} — adını değiştir`} title="Adını değiştir">
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </span>
    );
  }
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus
          value={value}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && cancel()}
          aria-label="Nokta adı"
          aria-invalid={error ? true : undefined}
          className={cn(inputCls, "h-8 w-56")}
        />
        <button type="submit" disabled={pending} className="rounded p-1.5 text-success hover:bg-success-soft" aria-label="Kaydet">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
        </button>
        <button type="button" onClick={cancel} className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Vazgeç">
          <X className="size-4" aria-hidden />
        </button>
      </form>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
