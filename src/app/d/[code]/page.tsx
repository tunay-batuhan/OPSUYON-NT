import type { Metadata } from "next";
import { MapPin, QrCode, Repeat } from "lucide-react";
import { Logo } from "@/components/logo";
import { PatrolScan } from "@/components/patrol-scan";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode } from "@/lib/patrol";

export const metadata: Metadata = { title: "Devriye", robots: { index: false, follow: false } };

/**
 * Devriye QR etiketinin açtığı herkese açık sayfa (görevli giriş yapmaz). Devriye bir TURDUR:
 * "Devriye başlat / bitir" etiketi PIN + ad sorup turu başlatır; nokta etiketleri hiçbir şey sormadan açık tura
 * kaydedilir; başlat/bitir etiketi tekrar okutulunca "Devriyeyi bitir" çıkar. Saat sunucudan alınır.
 * Sistemde olmayan ya da pasif bir kod hiçbir şey kaydetmez.
 */
export default async function PatrolScanPage({ params }: PageProps<"/d/[code]">) {
  const { code: raw } = await params;
  const code = normalizeCode(decodeURIComponent(raw)).slice(0, 40);

  const { data } = /^[A-Z0-9-]{6,32}$/.test(code)
    ? await createAdminClient().from("patrol_points").select("name, kind, projects(name)").eq("code", code).eq("is_active", true).maybeSingle()
    : { data: null };
  const point = data as unknown as { name: string; kind: "nokta" | "tur"; projects: { name: string } | null } | null;

  return (
    <div className="hero-glow flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center px-5 py-4">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          {point ? (
            <>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                {point.kind === "tur" ? <><Repeat className="size-3.5" aria-hidden /> Devriye turu</> : <><MapPin className="size-3.5" aria-hidden /> Devriye noktası</>}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{point.name}</h1>
              {point.projects?.name && <p className="mt-0.5 text-sm text-muted">{point.projects.name}</p>}
              <PatrolScan code={code} kind={point.kind} />
            </>
          ) : (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-muted" aria-hidden>
                <QrCode className="size-6" />
              </span>
              <h1 className="mt-4 text-xl font-semibold">QR kodu tanınmadı</h1>
              <p className="mt-1 text-sm text-muted">Bu kod sistemde kayıtlı değil ya da devre dışı bırakılmış. Devriye noktasındaki etiketi okuttuğunuzdan emin olun.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
