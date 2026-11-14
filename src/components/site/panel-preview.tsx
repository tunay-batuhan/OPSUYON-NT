import { BadgeCheck, CalendarCheck, CalendarOff, FileText, FolderOpen, LayoutDashboard, QrCode, ShieldCheck, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";

/**
 * Ana sayfa hero'sundaki panel çizimi: portalın görünüşünü anlatan SÜS (gerçek veri değil, ekran okuyucuya kapalı).
 * Yalnızca HTML/CSS; görsel dosyası yok, yüklenme maliyeti yok.
 */
const menu = [
  { icon: LayoutDashboard, label: "Genel bakış", active: true },
  { icon: Users, label: "Personel" },
  { icon: CalendarCheck, label: "Puantaj" },
  { icon: CalendarOff, label: "İzinler" },
  { icon: QrCode, label: "Devriye" },
  { icon: FolderOpen, label: "Cari hesap" },
];

const bars = [38, 52, 46, 64, 58, 72, 66, 80, 74, 88, 82, 94];

const rows = [
  { icon: QrCode, title: "Devriye turu · B Blok", meta: "12/12 nokta", tone: "emerald" },
  { icon: CalendarCheck, title: "Puantaj · Kasım", meta: "Yüklendi", tone: "blue" },
  { icon: FileText, title: "Bordro · Güvenlik", meta: "Paylaşıldı", tone: "violet" },
] as const;

export function PanelPreview() {
  return (
    <div aria-hidden className="relative select-none">
      {/* arka plan parıltısı */}
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_22%,transparent),transparent)]" />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_2px_4px_rgb(12_31_69/0.06),0_30px_60px_-12px_rgb(12_31_69/0.28)]">
        {/* tarayıcı çubuğu */}
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#f87171]" />
          <span className="size-2.5 rounded-full bg-[#fbbf24]" />
          <span className="size-2.5 rounded-full bg-[#34d399]" />
          <span className="ml-3 flex h-6 flex-1 items-center gap-1.5 rounded-md bg-surface px-2.5 text-[11px] text-muted">
            <ShieldCheck className="size-3 text-success" /> opsuyon.com/merkez
          </span>
        </div>

        <div className="grid grid-cols-[8.5rem_1fr]">
          {/* yan menü */}
          <div className="flex flex-col gap-1 bg-navy px-2.5 py-3">
            <div className="mb-2 flex items-center gap-1.5 px-1.5">
              <span className="grid size-6 place-items-center rounded-full bg-white"><LogoMark gradientId="lm-ring-pv" className="size-6" /></span>
              <span className="text-xs font-extrabold tracking-tight text-white">PSÜYON</span>
            </div>
            {menu.map(({ icon: Icon, label, active }) => (
              <span
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium ${active ? "bg-brand text-white" : "text-[#bcd0f2]"}`}
              >
                <Icon className="size-3.5" /> {label}
              </span>
            ))}
          </div>

          {/* içerik */}
          <div className="space-y-3 bg-bg/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-navy">Genel bakış</span>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-hover">Kasım</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Users, label: "Aktif personel", value: "128", tone: "blue" },
                { icon: CalendarCheck, label: "Puantaj", value: "%96", tone: "emerald" },
                { icon: CalendarOff, label: "İzin talebi", value: "4", tone: "amber" },
              ].map(({ icon: Icon, label, value, tone }) => (
                <div key={label} className="rounded-lg border border-border bg-surface p-2">
                  <span
                    className="grid size-6 place-items-center rounded-md"
                    style={{ background: `var(--tone-${tone}-soft)`, color: `var(--tone-${tone})` }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <p className="mt-1.5 text-base font-bold leading-none text-navy">{value}</p>
                  <p className="mt-1 text-[10px] text-muted">{label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-surface p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-navy">Devriye tamamlama</span>
                <span className="text-[10px] text-muted">son 12 gün</span>
              </div>
              <div className="mt-2 flex h-14 items-end gap-1">
                {bars.map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${h}%`, background: i === bars.length - 1 ? "var(--brand)" : "color-mix(in oklab, var(--brand) 32%, var(--surface))" }}
                  />
                ))}
              </div>
            </div>

            <ul className="space-y-1.5">
              {rows.map(({ icon: Icon, title, meta, tone }) => (
                <li key={title} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
                  <span className="grid size-6 place-items-center rounded-md" style={{ background: `var(--tone-${tone}-soft)`, color: `var(--tone-${tone})` }}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="flex-1 truncate text-[11px] font-medium text-navy">{title}</span>
                  <span className="text-[10px] text-muted">{meta}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* yüzen bildirim kartları */}
      <div className="site-float absolute -bottom-5 -left-6 hidden items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-card lg:flex">
        <span className="grid size-8 place-items-center rounded-lg bg-success-soft text-success"><QrCode className="size-4" /></span>
        <span>
          <span className="block text-xs font-semibold text-navy">Nokta okutuldu</span>
          <span className="block text-[11px] text-muted">Otopark girişi · 14:32</span>
        </span>
      </div>
      <div className="site-float-slow absolute -right-4 -top-5 hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-card lg:flex">
        <BadgeCheck className="size-5 text-brand" />
        <span className="text-xs font-semibold text-navy">İzin onaylandı</span>
      </div>
    </div>
  );
}
