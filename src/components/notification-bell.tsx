"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Canlı bildirim sayacı. Paylaşılan (app) layout'u istemci gezinmesinde yeniden çizilmediği için
 * sunucudan gelen ilk sayı bayatlıyordu (karşı taraf yazınca zil artmıyordu). Bu kanca
 * /api/notifications/count'u yoklar:
 *   - sekme görünürken 25 sn'de bir, sekmeye dönünce / pencere odaklanınca hemen,
 *     sayfa değişince kısa bir gecikmeyle (konu açılınca okundu bilgisi yazılmış olsun);
 *   - sekme gizliyken yoklama durur.
 * Toplam artınca zil sallanır, rozet "pop" yapar ve ekran okuyucuya kibarca duyurulur.
 * İlk (sunucu) çizimde animasyon yoktur.
 */

const POLL_MS = 25_000;
const AFTER_NAV_MS = 1_500;
const EVENT_GAP_MS = 2_000;

type Counts = { total: number; unread: number };
type Live = Counts & { ringTotal: number; ringUnread: number; announce: string };

function advance(s: Live, next: Counts): Live {
  if (next.total === s.total && next.unread === s.unread) return s;
  const moreTotal = next.total > s.total;
  return {
    ...next,
    ringTotal: moreTotal ? s.ringTotal + 1 : s.ringTotal,
    ringUnread: next.unread > s.unread ? s.ringUnread + 1 : s.ringUnread,
    announce: moreTotal ? `Yeni bildirim var. Toplam ${next.total} bildirim.` : s.announce,
  };
}

export function useLiveNotifications(serverTotal: number, serverUnread: number, pathname: string): Live {
  const [live, setLive] = useState<Live>({ total: serverTotal, unread: serverUnread, ringTotal: 0, ringUnread: 0, announce: "" });

  // Layout yeniden çizilip yeni sayılar gelirse (ör. server action sonrası) onları da al.
  const [server, setServer] = useState<Counts>({ total: serverTotal, unread: serverUnread });
  if (server.total !== serverTotal || server.unread !== serverUnread) {
    setServer({ total: serverTotal, unread: serverUnread });
    setLive((s) => advance(s, { total: serverTotal, unread: serverUnread }));
  }

  const inflight = useRef<AbortController | null>(null);
  const lastEventLoad = useRef(0);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      const res = await fetch("/api/notifications/count", { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) return;
      const d = (await res.json()) as { total?: unknown; unread_threads?: unknown };
      if (typeof d.total !== "number" || typeof d.unread_threads !== "number") return;
      const next = { total: d.total, unread: d.unread_threads };
      setLive((s) => advance(s, next));
    } catch {
      // ağ hatası / iptal: bir sonraki yoklamada yeniden denenir
    } finally {
      if (inflight.current === ctrl) inflight.current = null;
    }
  }, []);

  // Periyodik yoklama; sekme gizliyken durur.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer === undefined) timer = setInterval(() => void load(), POLL_MS);
    };
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const onEvent = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastEventLoad.current < EVENT_GAP_MS) return;
      lastEventLoad.current = now;
      void load();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
        onEvent();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onEvent);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onEvent);
      inflight.current?.abort();
    };
  }, [load]);

  // Sayfa değişince (ör. konu açıldı → okundu) kısa gecikmeyle tazele; ilk açılışta değil.
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const t = setTimeout(() => void load(), AFTER_NAV_MS);
    return () => clearTimeout(t);
  }, [pathname, load]);

  return live;
}

/** Zil simgesi; `ring` artınca yeniden takılıp sallanma animasyonunu oynatır (0 → animasyon yok). */
export function RingingBell({ ring, className }: { ring: number; className?: string }) {
  return (
    <span key={ring} className={cn("block", ring > 0 && "notif-ring")} aria-hidden>
      <Bell className={className} />
    </span>
  );
}

/** Sayaç rozeti; `pop` artınca "pop" animasyonu oynar. */
export function NotifBadge({ n, pop }: { n: number; pop: number }) {
  if (!n) return null;
  return (
    <span
      key={pop}
      className={cn(
        "absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[var(--tone-amber)] px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white",
        pop > 0 && "notif-pop",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Ekran okuyucular için kibar duyuru (yalnızca yeni bildirim gelince dolar). */
export function NotifAnnouncer({ text }: { text: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </p>
  );
}
