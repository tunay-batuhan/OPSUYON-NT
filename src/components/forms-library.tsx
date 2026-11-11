"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Search } from "lucide-react";
import { Card, CardHeader, EmptyState, cn, inputCls } from "@/components/ui";
import { deleteFormTemplate } from "@/app/actions/forms";
import { DeleteDocButton } from "@/components/delete-doc-button";
import { ViewButton } from "@/components/doc-viewer";
import { formatBytes } from "@/lib/format";
import { PAGE_SIZE, pageCount } from "@/lib/paging";
import { matches } from "@/lib/text";

export type FormItem = { id: string; title: string; description: string | null; file_name: string; size_bytes: number | null };

const LIST_ID = "form-listesi";

/**
 * Form şablonları: birkaç harf yazınca liste anında süzülür (Türkçe karakter ve büyük/küçük harf fark etmez).
 * Liste bellekte 10'ar sayfalanır; arama değişince 1. sayfaya dönülür.
 */
export function FormsLibrary({ items, manage }: { items: FormItem[]; manage: boolean }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const shown = useMemo(() => items.filter((i) => matches(`${i.title} ${i.description ?? ""} ${i.file_name}`, q)), [items, q]);
  // Form silinince sayfa sayısı azalabilir: geçerli aralıkta tut
  const current = Math.min(page, pageCount(shown.length));
  const visible = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function goTo(n: number) {
    setPage(n);
    // Alttaki sayfa düğmesinden geçince listenin başı görünmüyorsa oraya kaydır
    const el = document.getElementById(LIST_ID);
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }

  return (
    <Card id={LIST_ID}>
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
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
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
          {visible.map((f) => (
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
                <ViewButton src={`/api/forms/${f.id}/view`} title={f.title} downloadHref={`/api/forms/${f.id}`} />
                {manage && (
                  <DeleteDocButton
                    id={f.id}
                    title={f.title}
                    back="/formlar"
                    action={deleteFormTemplate}
                    confirm={{ description: "Form şablonu ve dosyası kalıcı olarak silinir; müşteriler artık göremez. Bu işlem geri alınamaz." }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager page={current} total={shown.length} onPage={goTo} />
    </Card>
  );
}

/** Bellekte sayfalama düğmeleri (sunucu tarafı <Pagination> ile aynı görünüm). */
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (n: number) => void }) {
  const pages = pageCount(total);
  if (total <= PAGE_SIZE) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  // 1 … c-1 c c+1 … N
  const seq = [...new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);

  const btn = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm";
  const idle = "border-border hover:bg-surface-2 disabled:text-muted/50 disabled:hover:bg-transparent";
  return (
    <nav aria-label="Sayfalama" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm">
      <p className="text-muted">
        {first}–{last} / {total} form
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Önceki sayfa" className={cn(btn, idle)}>
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {seq.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - seq[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            {n === page ? (
              <span aria-current="page" className={cn(btn, "border-brand bg-brand text-brand-fg")}>{n}</span>
            ) : (
              <button type="button" onClick={() => onPage(n)} className={cn(btn, idle)}>{n}</button>
            )}
          </span>
        ))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Sonraki sayfa" className={cn(btn, idle)}>
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
