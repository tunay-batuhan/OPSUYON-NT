"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Search, Trash2 } from "lucide-react";
import { Card, CardHeader, EmptyState, inputCls } from "@/components/ui";
import { deleteFormTemplate } from "@/app/actions/forms";
import { formatBytes } from "@/lib/format";
import { matches } from "@/lib/text";

export type FormItem = { id: string; title: string; description: string | null; file_name: string; size_bytes: number | null };

/** Form şablonları: birkaç harf yazınca liste anında süzülür (Türkçe karakter ve büyük/küçük harf fark etmez). */
export function FormsLibrary({ items, manage }: { items: FormItem[]; manage: boolean }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => items.filter((i) => matches(`${i.title} ${i.description ?? ""} ${i.file_name}`, q)), [items, q]);

  return (
    <Card>
      <CardHeader
        title={q.trim() ? `${shown.length} / ${items.length} form` : `${items.length} form`}
        description="Formu seçip indirin; çıktı alıp doldurabilirsiniz."
        action={
          <label className="relative block">
            <span className="sr-only">Form ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Form ara… (birkaç harf yeter)"
              autoComplete="off"
              maxLength={60}
              className={inputCls + " h-9 w-64 pl-9"}
            />
          </label>
        }
      />
      {shown.length === 0 ? (
        <EmptyState title={items.length === 0 ? "Henüz form eklenmemiş" : "Aramanıza uyan form yok"} description={items.length === 0 ? "Merkez form eklediğinde burada görünür." : "Farklı harfler deneyin."} />
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger" aria-hidden>
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{f.title}</p>
                  <p className="truncate text-xs text-muted">
                    {f.description ? `${f.description} · ` : ""}
                    {f.file_name}
                    {f.size_bytes ? ` · ${formatBytes(f.size_bytes)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/forms/${f.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft"
                >
                  <Download className="size-4" aria-hidden /> İndir
                </a>
                {manage && (
                  <form action={deleteFormTemplate}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`${f.title} formunu sil`}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
