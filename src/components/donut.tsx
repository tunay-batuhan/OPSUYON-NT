export type DonutSlice = { label: string; value: number; color: string };

/** Pure-SVG donut chart (no client JS). Colours arrive as CSS values (var(...) works). */
export function Donut({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 15.915; // circumference ≈ 100 → values are percentages
  let offset = 25; // start at 12 o'clock

  return (
    <div className="flex flex-wrap items-center gap-6">
      <figure className="relative size-40 shrink-0" aria-label={`${centerLabel}: ${total}`}>
        <svg viewBox="0 0 42 42" className="size-full -rotate-0">
          <circle cx="21" cy="21" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
          {total > 0 &&
            slices.map((s) => {
              const pct = (s.value / total) * 100;
              const el = (
                <circle
                  key={s.label}
                  cx="21" cy="21" r={r} fill="none" stroke={s.color} strokeWidth="6"
                  strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset}
                />
              );
              offset -= pct;
              return el;
            })}
        </svg>
        <figcaption className="absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-2xl font-bold tabular-nums">{total}</span>
            <span className="block text-[11px] text-muted">{centerLabel}</span>
          </span>
        </figcaption>
      </figure>
      <ul className="min-w-40 flex-1 space-y-2.5 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="flex-1">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
