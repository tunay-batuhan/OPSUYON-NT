"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { cn } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = {
  customer: [
    "Yıllık izin bilgilerini nereden görürüm?",
    "Bordromu nasıl indiririm?",
    "Denetim raporlarına nasıl ulaşırım?",
    "Faturalara nasıl bakarım?",
  ],
  staff: [
    "Yeni müşteri nasıl eklenir?",
    "Belge nasıl yüklerim?",
    "Müşteri hesabı nasıl açılır?",
    "Vardiya planı nasıl yapılır?",
  ],
} as const;

/** **kalın** işaretlerini <strong> yapar; başka biçimlendirme yapmaz (HTML basılmaz). */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** Modelin yanıtındaki paragraf, numaralı ve madde işaretli listeleri gösterir. */
function Rich({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={blocks.length} className="my-1.5 list-decimal space-y-1 pl-5">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ol>);
    } else if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""));
      blocks.push(<ul key={blocks.length} className="my-1.5 list-disc space-y-1 pl-5">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>);
    } else if (line.trim() === "") {
      i++;
    } else {
      blocks.push(<p key={blocks.length} className="my-1.5 first:mt-0 last:mb-0">{inline(line)}</p>);
      i++;
    }
  }
  return <>{blocks}</>;
}

/**
 * Sağ altta açılan "Opsüyon AI" yardım asistanı (test aşaması). Sohbet yalnızca bu sayfa açık kaldığı sürece
 * tarayıcıda tutulur; sunucuda kaydedilmez.
 */
export function Assistant({ kind }: { kind: "staff" | "customer" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (content: string) => setMessages((m) => [...m.slice(0, -1), { role: "assistant", content }]);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, path: pathname }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        patch(`⚠️ ${err?.error ?? "Şu an yanıt veremiyorum. Lütfen biraz sonra tekrar deneyin."}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        patch(acc);
      }
      acc += decoder.decode();
      patch(acc || "Bir yanıt oluşturamadım, sorunuzu farklı sormayı dener misiniz?");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) patch("⚠️ Bağlantı kesildi. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
    setInput("");
  }

  const waiting = busy && messages.at(-1)?.content === "";

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Opsüyon AI yardım asistanı"
          className="fixed inset-x-3 bottom-36 z-50 flex h-[min(34rem,calc(100dvh-11rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[24rem] lg:bottom-24"
        >
          <header className="flex items-center gap-3 bg-[var(--side-bg)] px-4 py-3 text-white">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand" aria-hidden>
              <Sparkles className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">Opsüyon AI</p>
              <p className="truncate text-xs text-white/70">Portal yardım asistanı · test sürümü</p>
            </div>
            {messages.length > 0 && (
              <button onClick={reset} className="grid size-8 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white" aria-label="Yeni sohbet" title="Yeni sohbet">
                <RotateCcw className="size-4" aria-hidden />
              </button>
            )}
            <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white" aria-label="Asistanı kapat">
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <div ref={listRef} aria-live="polite" aria-busy={busy} className="flex-1 space-y-3 overflow-y-auto bg-bg px-4 py-4 text-sm">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-surface px-3.5 py-3 shadow-card">
                  <p className="font-medium">Merhaba, ben Opsüyon AI 👋</p>
                  <p className="mt-1 text-muted">Portaldaki her ekranı ve işlevi biliyorum. Gitmek istediğiniz yeri veya yapmak istediğiniz işi yazın, adım adım yolunu tarif edeyim.</p>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Örnek sorular</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS[kind].map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-[13px] hover:border-brand hover:bg-brand-soft">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 leading-relaxed",
                      m.role === "user" ? "rounded-br-sm bg-brand text-brand-fg" : "rounded-tl-sm bg-surface shadow-card",
                    )}
                  >
                    {m.role === "user" ? m.content : m.content ? <div className="whitespace-normal"><Rich text={m.content} /></div> : null}
                    {m.role === "assistant" && waiting && idx === messages.length - 1 && (
                      <span className="inline-flex items-center gap-1 text-muted" aria-label="Yanıt yazılıyor">
                        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-current" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(input); }}
            className="flex items-end gap-2 border-t border-border bg-surface p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Sorunuzu yazın…"
              aria-label="Opsüyon AI'ya soru"
              className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm placeholder:text-muted/70 focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length === 0}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-fg hover:bg-brand-hover disabled:opacity-50"
              aria-label="Gönder"
            >
              <SendHorizontal className="size-[18px]" aria-hidden />
            </button>
          </form>
        </section>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Asistanı kapat" : "Opsüyon AI'ya sor"}
        className="fixed bottom-20 right-4 z-50 flex h-12 items-center gap-2 rounded-full bg-brand px-4 font-medium text-brand-fg shadow-lg ring-4 ring-white/70 transition hover:bg-brand-hover sm:right-5 lg:bottom-6"
      >
        {open ? <X className="size-5" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
        <span className="hidden sm:inline">Opsüyon AI</span>
      </button>
    </>
  );
}
