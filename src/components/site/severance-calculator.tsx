"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertCircle, Calculator, Info } from "lucide-react";
import { cn } from "@/components/ui";
import {
  DAMGA_VERGISI_ORANI, IHBAR_GELIR_VERGISI_ORANI, KIDEM_TAVANI, calculateSeverance, formatService, formatTRY, parseMoney,
  validateSeverance, type SeveranceErrors,
} from "@/lib/severance-calc";

/** İletişim formundaki alan görünümüyle aynı. */
const control =
  "block w-full min-w-0 appearance-none rounded-lg border border-border bg-surface px-3 h-11 text-base sm:text-sm text-fg placeholder:text-muted/60 " +
  "transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 " +
  "aria-invalid:border-danger aria-invalid:bg-danger-soft/40 aria-invalid:focus:ring-danger/20";

const pct = (r: number) => `%${(r * 100).toLocaleString("tr-TR", { maximumFractionDigits: 3 })}`;
const permille = (r: number) => `binde ${(r * 1000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
const trDate = (iso: string) => iso.split("-").reverse().join(".");

type Field = keyof SeveranceErrors;

function FieldBox({
  id, label, optional, error, hint, children,
}: { id: string; label: string; optional?: boolean; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(isteğe bağlı)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Row({ label, value, strong, negative }: { label: ReactNode; value: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "font-semibold text-navy")}>
      <dt className={cn("min-w-0", !strong && "text-fg/80")}>{label}</dt>
      <dd className={cn("shrink-0 text-right tabular-nums", negative && "text-danger")}>{negative ? `− ${value}` : value}</dd>
    </div>
  );
}

/**
 * Ana sayfadaki kıdem ve ihbar tazminatı hesaplayıcısı. Hesap src/lib/severance-calc.ts'de; burada yalnızca girdiler
 * ve sonuç tablosu var. Sonuç yazdıkça güncellenir; ekran okuyucuya toplam tutar kısa bir canlı bölgeden okunur.
 */
export function SeveranceCalculator() {
  const uid = useId();
  const ids = { start: `${uid}-start`, end: `${uid}-end`, grossWage: `${uid}-wage`, extras: `${uid}-extras`, notice: `${uid}-notice` };

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [wage, setWage] = useState("");
  const [extras, setExtras] = useState("");
  const [noticeApplies, setNoticeApplies] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});

  const grossWage = parseMoney(wage);
  const extrasValue = extras.trim() ? parseMoney(extras) : undefined;
  const errors = validateSeverance({ start, end, grossWage, extras: extrasValue });
  const result = calculateSeverance({ start, end, grossWage, extras: extrasValue, noticeApplies });

  // Hata, alana dokunulduktan (odaktan çıkınca) ya da bir değer girildikten sonra gösterilir.
  const values: Record<Field, string> = { start, end, grossWage: wage, extras };
  const shown = (f: Field) => (touched[f] || values[f].trim() !== "" ? errors[f] : undefined);
  const touch = (f: Field) => () => setTouched((t) => (t[f] ? t : { ...t, [f]: true }));
  const describe = (f: Field, hint?: boolean) => (shown(f) ? `${ids[f]}-err` : hint ? `${ids[f]}-hint` : undefined);

  const summary = result
    ? `Tahmini toplam net tazminat ${formatTRY(result.totalNet)}. Kıdem net ${formatTRY(result.kidemNet)}, ihbar net ${formatTRY(result.ihbarNet)}.`
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---------------- Girdiler ---------------- */}
      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        aria-label="Tazminat hesaplama bilgileri"
        className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldBox id={ids.start} label="İşe giriş tarihi" error={shown("start")}>
            <input
              id={ids.start}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              onBlur={touch("start")}
              aria-invalid={Boolean(shown("start")) || undefined}
              aria-describedby={describe("start")}
              className={control}
            />
          </FieldBox>
          <FieldBox id={ids.end} label="İşten çıkış tarihi" error={shown("end")} hint="Son çalışılan gün (hizmete dahil).">
            <input
              id={ids.end}
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              onBlur={touch("end")}
              aria-invalid={Boolean(shown("end")) || undefined}
              aria-describedby={describe("end", true)}
              className={control}
            />
          </FieldBox>
          <FieldBox id={ids.grossWage} label="Aylık brüt ücret (₺)" error={shown("grossWage")} hint="Ör. 50.000 ya da 50.000,50">
            <input
              id={ids.grossWage}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="50.000"
              value={wage}
              onChange={(e) => setWage(e.target.value)}
              onBlur={touch("grossWage")}
              aria-invalid={Boolean(shown("grossWage")) || undefined}
              aria-describedby={describe("grossWage", true)}
              className={control}
            />
          </FieldBox>
          <FieldBox
            id={ids.extras}
            label="Düzenli ek ödemeler (₺)"
            optional
            error={shown("extras")}
            hint="Yemek, yol vb. aylık brüt; giydirilmiş ücrete eklenir."
          >
            <input
              id={ids.extras}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={extras}
              onChange={(e) => setExtras(e.target.value)}
              onBlur={touch("extras")}
              aria-invalid={Boolean(shown("extras")) || undefined}
              aria-describedby={describe("extras", true)}
              className={control}
            />
          </FieldBox>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <input
            id={ids.notice}
            type="checkbox"
            checked={noticeApplies}
            onChange={(e) => setNoticeApplies(e.target.checked)}
            aria-describedby={`${ids.notice}-hint`}
            className="mt-0.5 size-5 shrink-0 accent-brand"
          />
          <div className="min-w-0">
            <label htmlFor={ids.notice} className="text-sm font-medium text-fg">İhbar tazminatı hesaplansın</label>
            <p id={`${ids.notice}-hint`} className="mt-0.5 text-xs text-muted">
              İşveren iş sözleşmesini bildirim süresi tanımadan feshettiyse ödenir.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Kıdem tazminatı tavanı: <span className="font-medium text-fg">{formatTRY(KIDEM_TAVANI.amount)}</span>{" "}
          ({trDate(KIDEM_TAVANI.from)} – {trDate(KIDEM_TAVANI.to)} dönemi).
        </p>
      </form>

      {/* ---------------- Sonuç ---------------- */}
      <section aria-labelledby={`${uid}-res`} className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <h3 id={`${uid}-res`} className="flex items-center gap-2 text-base font-semibold text-navy">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden>
            <Calculator className="size-5" />
          </span>
          Tahmini sonuç
        </h3>

        {/* ekran okuyucu için kısa özet; tablo her tuşta baştan okunmasın */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">{summary}</p>

        {!result ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            Sonucu görmek için işe giriş ve çıkış tarihlerini ve aylık brüt ücreti girin.
          </p>
        ) : (
          <div className="mt-4 space-y-5 text-sm">
            <dl className="rounded-xl bg-surface-2 px-4 py-2">
              <Row label="Hizmet süresi" value={formatService(result.service)} strong />
              <Row label="Giydirilmiş aylık brüt ücret" value={formatTRY(result.dressedWage)} />
            </dl>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-hover">Kıdem tazminatı</h4>
              {result.kidemEligible ? (
                <>
                  {result.capped && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      Ücret tavanı aştığı için kıdemde {formatTRY(result.kidemBaseWage)} esas alındı.
                    </p>
                  )}
                  <dl className="mt-1 divide-y divide-border">
                    <Row label="Kıdem brüt" value={formatTRY(result.kidemGross)} />
                    <Row label={`Damga vergisi (${permille(DAMGA_VERGISI_ORANI)})`} value={formatTRY(result.kidemStamp)} negative />
                    <Row label="Kıdem net" value={formatTRY(result.kidemNet)} strong />
                  </dl>
                </>
              ) : (
                <p className="mt-1.5 flex items-start gap-1.5 text-fg/80">
                  <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  Kıdem tazminatı için aynı işverende en az 1 tam yıl çalışmış olmak gerekir; bu süre dolmadığı için kıdem tazminatı
                  doğmaz ({formatTRY(0)}).
                </p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-hover">İhbar tazminatı</h4>
              {result.noticeApplies ? (
                <dl className="mt-1 divide-y divide-border">
                  <Row label="İhbar süresi" value={`${result.noticeWeeks} hafta`} />
                  <Row label="İhbar brüt" value={formatTRY(result.ihbarGross)} />
                  <Row label={`Gelir vergisi (tahmini ${pct(IHBAR_GELIR_VERGISI_ORANI)})`} value={formatTRY(result.ihbarIncomeTax)} negative />
                  <Row label={`Damga vergisi (${permille(DAMGA_VERGISI_ORANI)})`} value={formatTRY(result.ihbarStamp)} negative />
                  <Row label="İhbar net" value={formatTRY(result.ihbarNet)} strong />
                </dl>
              ) : (
                <p className="mt-1.5 text-fg/80">
                  İhbar tazminatı hesaplanmadı (yasal ihbar süresi {result.noticeWeeks} hafta).
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-navy px-4 py-3 text-white">
              <span className="font-semibold">Toplam net</span>
              <span className="text-xl font-bold tabular-nums">{formatTRY(result.totalNet)}</span>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Bu hesap yalnızca tahmindir. Gerçek tutarlar iş sözleşmesine, fesih şekline, yıl içindeki kümülatif gelir vergisi
          matrahına ve fesih tarihindeki güncel kıdem tazminatı tavanına göre değişir. Kesin hesap için bir mali müşavir ya da iş
          hukuku uzmanına danışın.
        </p>
      </section>
    </div>
  );
}
