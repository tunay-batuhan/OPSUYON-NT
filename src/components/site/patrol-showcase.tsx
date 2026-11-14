import { BadgeCheck, CheckCircle2, Circle, Clock3, FileDown, MapPin, QrCode, Smartphone } from "lucide-react";

/**
 * Ana sayfadaki "QR devriye" bölümü: solda anlatım, sağda hareketli telefon çizimi (kamerada QR, tarama çizgisi,
 * "Nokta okutuldu" bildirimi, tur ilerlemesi) ve arkasında kesikli rota. Yalnızca HTML/CSS/SVG; çizim SÜS (aria-hidden).
 */

/** QR görünümlü desen: üç köşe kare + sabit (her çizimde aynı) noktalar. */
function FakeQr({ className }: { className?: string }) {
  const N = 21;
  const cells: [number, number][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) cells.push([x, y]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" rx="1.2" fill="currentColor" />
      <rect x={x + 1} y={y + 1} width="5" height="5" rx="0.8" fill="white" />
      <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.6" fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className={className}>
      <rect x="-1" y="-1" width={N + 2} height={N + 2} rx="2" fill="white" />
      {cells.map(([x, y]) => <rect key={`${x}.${y}`} x={x + 0.1} y={y + 0.1} width="0.8" height="0.8" rx="0.2" fill="currentColor" />)}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  );
}

const points = [
  { name: "Otopark girişi", time: "14:32", done: true },
  { name: "B Blok lobi", time: "14:41", done: true },
  { name: "Jeneratör odası", time: "14:50", done: true },
  { name: "Çatı kapısı", time: "", done: false },
  { name: "Arka bahçe", time: "", done: false },
];

const bullets = [
  { icon: Smartphone, text: "Uygulama yok: görevli kendi telefonunun kamerasıyla okutur." },
  { icon: QrCode, text: "Tur, “Devriye başlat / bitir” etiketi ve proje PIN’iyle başlar." },
  { icon: MapPin, text: "Tarayıcı izin verirse okutma konumu da kaydedilir." },
  { icon: FileDown, text: "Atlanan noktalar ve günlük rapor tek tıkla PDF." },
];

export function PatrolShowcase() {
  return (
    <section id="devriye" aria-labelledby="devriye-baslik" className="relative scroll-mt-6 overflow-hidden border-y border-border bg-surface">
      <div aria-hidden className="site-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 lg:grid-cols-2 lg:py-24">
        {/* anlatım */}
        <div className="site-reveal">
          <p className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-[#0f7a3a]">
            <QrCode className="size-4" aria-hidden /> QR devriye sistemi
          </p>
          <h2 id="devriye-baslik" className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Devriye turları artık <span className="site-mark">kayıt altında</span>
          </h2>
          <p className="mt-4 max-w-lg text-fg/80">
            Noktalara asılan QR etiketlerini görevli okutur; hangi noktanın ne zaman okutulduğu, hangisinin atlandığı anında
            panelinize düşer.
          </p>
          <ul className="mt-8 space-y-4">
            {bullets.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy text-white shadow-card" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span className="pt-2 text-fg/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* çizim */}
        <div aria-hidden className="site-reveal relative mx-auto w-full max-w-md select-none">
          {/* arka plandaki kesikli rota + nokta işaretleri */}
          <svg viewBox="0 0 400 460" className="pointer-events-none absolute inset-0 size-full text-brand/40">
            <path
              d="M40 400 C 20 300, 120 300, 90 220 S 30 90, 140 60 S 330 40, 360 140 S 300 300, 370 380"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="10 14"
              strokeLinecap="round"
              className="site-dash"
            />
            {[[40, 400], [90, 220], [140, 60], [360, 140], [370, 380]].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="14" className={i < 3 ? "fill-success/20" : "fill-brand/15"} />
                <circle cx={x} cy={y} r="6" className={i < 3 ? "fill-success" : "fill-brand/60"} />
              </g>
            ))}
          </svg>

          {/* telefon */}
          <div className="site-float relative mx-auto w-[15.5rem] rounded-[2.6rem] border-[10px] border-navy bg-navy shadow-[0_30px_60px_-15px_rgb(12_31_69/0.45)] sm:w-[17rem]">
            <span className="absolute left-1/2 top-1.5 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-navy" />
            <div className="relative overflow-hidden rounded-[2rem] bg-[#0b1324]">
              {/* kamera görüntüsü */}
              <div className="relative grid aspect-[4/5] place-items-center bg-[radial-gradient(circle_at_50%_40%,#2a3a5c,#0b1324_70%)]">
                <div className="relative grid size-40 place-items-center rounded-2xl bg-white p-2.5 shadow-lg">
                  <FakeQr className="size-full text-navy" />
                  {/* köşe çerçeveleri */}
                  {["left-0 top-0 border-l-4 border-t-4 rounded-tl-xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl"].map((c) => (
                    <span key={c} className={`absolute -m-3 size-8 border-accent ${c}`} />
                  ))}
                  {/* tarama çizgisi */}
                  <span className="site-scan absolute inset-x-1 h-0.5 rounded-full bg-accent shadow-[0_0_14px_4px_color-mix(in_oklab,var(--accent)_70%,transparent)]" />
                </div>
                <p className="absolute bottom-3 text-[11px] font-medium text-white/70">QR kodu çerçeveye hizalayın</p>
                {/* okutuldu bildirimi */}
                <div className="site-toast absolute inset-x-3 top-5 flex items-center gap-2.5 rounded-xl bg-white/95 px-3 py-2.5 shadow-lg">
                  <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-success text-white">
                    <span className="site-pulse-ring absolute inset-0 rounded-full bg-success" />
                    <BadgeCheck className="relative size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-navy">Nokta okutuldu</span>
                    <span className="block truncate text-[11px] text-muted">Otopark girişi · 14:32</span>
                  </span>
                </div>
              </div>
              {/* tur ilerlemesi */}
              <div className="space-y-2 bg-surface px-3.5 pb-5 pt-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-navy">
                  <span>Akşam turu</span>
                  <span className="text-muted">3 / 5 nokta</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="site-fill h-full w-3/5 rounded-full bg-gradient-to-r from-success to-brand" />
                </div>
                <ul className="space-y-1.5 pt-1">
                  {points.map((pt) => (
                    <li key={pt.name} className="flex items-center gap-2 text-[11px]">
                      {pt.done ? <CheckCircle2 className="size-3.5 text-success" /> : <Circle className="size-3.5 text-border" />}
                      <span className={pt.done ? "flex-1 font-medium text-navy" : "flex-1 text-muted"}>{pt.name}</span>
                      {pt.time ? <span className="text-muted">{pt.time}</span> : <Clock3 className="size-3 text-muted/60" />}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* yan kart: günlük rapor */}
          <div className="site-float-slow absolute -right-2 bottom-16 hidden items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-card sm:flex">
            <span className="grid size-8 place-items-center rounded-lg bg-danger-soft text-danger"><FileDown className="size-4" /></span>
            <span>
              <span className="block text-xs font-semibold text-navy">Günlük rapor</span>
              <span className="block text-[11px] text-muted">PDF · 1 nokta atlandı</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
