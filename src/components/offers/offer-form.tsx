"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch, type FieldArrayWithId, type FieldErrors } from "react-hook-form";
import { ArrowLeft, ArrowRight, Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { saveOffer } from "@/app/actions/offers";
import { COST_INPUT_LABELS, COST_PARAM_LABELS, COST_RATE_KEYS, calcCost, calcOffer, formatRate, type CostParams, type OfferCalc } from "@/lib/offer-calc";
import {
  COST_FIELDS, EMPTY_LINE, STEP1_FIELDS, hasCost, lineCost, offerLines, offerNumbers, offerParams, offerSchema, paramsToForm, type OfferValues,
} from "@/lib/schemas-offers";
import { formatMoney } from "@/lib/format";
import { CheckboxField, Form, FormGrid, TextField, TextareaField, control } from "@/components/forms/form";
import { DateField } from "@/components/forms/date-fields";
import { btn, cn } from "@/components/ui";
import { CostTable, OfferResult } from "@/components/offers/offer-result";

/** Tablette rahat dokunulan kutu (h-12, büyük yazı). */
const big = cn(control, "h-12 text-base");
const GRID = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_2.75rem]";
const card = "rounded-2xl border border-border bg-surface p-5 shadow-card";

type Rows = FieldArrayWithId<OfferValues, "lines", "id">[];

/** Formdaki güncel değerlerle canlı hesap (her tuşta): satırlar, teklife özel oranlar ve "fiyata dahil fonlar" işaretleri. */
function useLive() {
  const { control: ctl } = useFormContext<OfferValues>();
  const [lines, vat_rate, fee_per_person, profit_pct, compare, fs, fl, fh, rates] = useWatch({
    control: ctl,
    name: ["lines", "vat_rate", "fee_per_person", "profit_pct", "compare", "fund_severance", "fund_leave", "fund_holiday", "params"],
  });
  const n = offerNumbers({ vat_rate: vat_rate ?? "", fee_per_person: fee_per_person ?? "", profit_pct: profit_pct ?? "" });
  const params = offerParams({ params: rates ?? {}, fund_severance: Boolean(fs), fund_leave: Boolean(fl), fund_holiday: Boolean(fh) });
  const on = Boolean(compare);
  const rows = lines ?? [];
  const calc: OfferCalc = calcOffer(offerLines(rows, on), n.vat, n.fee, n.pct, params);
  return { lines: rows, compare: on, params, calc, ...n };
}

/**
 * 1. adım: müşterinin bugün satın aldığı hizmetler. Hizmet, kişi sayısı, KİŞİ BAŞI BEDEL (yazılır) → aylık bedel.
 * 2. adımda brüt maaşı girilen hizmetin bedeli maliyet tablosundan hesaplanır; burada salt okunur görünür.
 */
function ServiceRows({ fields, append, remove }: { fields: Rows; append: () => void; remove: (i: number) => void }) {
  const { register, formState } = useFormContext<OfferValues>();
  const { lines, compare, calc } = useLive();
  const errs = formState.errors.lines;
  const rootError = (errs as { root?: { message?: string }; message?: string } | undefined)?.root?.message ?? (errs as { message?: string } | undefined)?.message;

  return (
    <fieldset>
      <legend className="mb-3 text-base font-semibold">Müşterinin bugün satın aldığı hizmetler</legend>
      <div className={cn("hidden gap-3 px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted md:grid", GRID)}>
        <span>Hizmet</span>
        <span>Kişi sayısı</span>
        <span>Kişi başı bedel (KDV hariç)</span>
        <span className="text-right">Aylık bedel</span>
        <span />
      </div>
      <div className="space-y-3">
        {fields.map((f, i) => {
          const e = Array.isArray(errs) ? errs[i] : undefined;
          const row = calc.lines[i];
          const fromCost = compare && lines[i] !== undefined && hasCost(lines[i]);
          return (
            <div key={f.id} className={cn("grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-2/40 p-3 md:items-start md:border-0 md:bg-transparent md:p-0", GRID)}>
              <label className="col-span-2 md:col-span-1">
                <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Hizmet</span>
                <input {...register(`lines.${i}.service`)} autoComplete="off" aria-invalid={e?.service ? true : undefined} placeholder="Örn. Güvenlik" className={big} />
                {e?.service && <span role="alert" className="mt-1 block text-xs text-danger">{e.service.message}</span>}
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Kişi sayısı</span>
                <input {...register(`lines.${i}.people`)} autoComplete="off" inputMode="numeric" placeholder="0" aria-invalid={e?.people ? true : undefined} className={cn(big, "text-center")} />
                {e?.people && <span role="alert" className="mt-1 block text-xs text-danger">{e.people.message}</span>}
              </label>
              {fromCost ? (
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Kişi başı bedel (KDV hariç)</span>
                  <p className="flex h-12 items-center justify-end rounded-lg border border-dashed border-border bg-surface-2/60 px-3 text-base tabular-nums" title="2. adımdaki maliyet kalemlerinden hesaplanır">
                    {formatMoney(row?.unit_price ?? 0)}
                  </p>
                  <span className="mt-1 block text-right text-xs text-muted">maliyet tablosundan</span>
                </div>
              ) : (
                <label>
                  <span className="mb-1 block text-xs font-medium text-muted md:sr-only">Kişi başı bedel (KDV hariç)</span>
                  <span className="relative block">
                    <input {...register(`lines.${i}.unit_price`)} autoComplete="off" inputMode="decimal" placeholder="0" aria-invalid={e?.unit_price ? true : undefined} className={cn(big, "pr-8 text-right")} />
                    <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-muted">₺</span>
                  </span>
                  {e?.unit_price && <span role="alert" className="mt-1 block text-xs text-danger">{e.unit_price.message}</span>}
                </label>
              )}
              <p className="col-span-2 flex h-12 items-center justify-between rounded-lg bg-surface px-3 text-sm tabular-nums md:col-span-1 md:justify-end md:bg-transparent md:text-base">
                <span className="text-xs text-muted md:hidden">Aylık bedel</span>
                <span className="font-semibold">{row && row.people > 0 ? formatMoney(row.monthly_total) : "—"}</span>
              </p>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={fields.length <= 1}
                aria-label={`${lines[i]?.service || "Satırı"} kaldır`}
                className="grid h-12 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40 max-md:border max-md:border-border"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      {rootError && <p role="alert" className="mt-2 text-sm text-danger">{rootError}</p>}
      <button type="button" onClick={append} disabled={fields.length >= 30} className={btn("secondary", "lg", "mt-3 w-full sm:w-auto")}>
        <Plus className="size-5" aria-hidden /> Hizmet ekle
      </button>
      <p className="mt-2 text-xs text-muted">
        Kişi başı bedeli müşterinin son ayki faturasından (KDV hariç) yazın; aylık bedel kendiliğinden hesaplanır. Kuruş için virgül: 58.333,33
      </p>
    </fieldset>
  );
}

/**
 * 2. adım: her hizmetin maliyet kalemleri (kişi başı, aylık). Brüt maaş yazılan hizmetin kişi başı bedeli maliyet
 * tablosundan hesaplanır ve tablonun tamamı (Excel'deki "MALİYET ANALİZ TABLOSU") altında gösterilir.
 */
function CostCards({ fields }: { fields: Rows }) {
  const { register, formState } = useFormContext<OfferValues>();
  const { lines, params, pct, calc } = useLive();
  const errs = formState.errors.lines;
  const shown = fields.map((f, i) => ({ f, i })).filter(({ i }) => (lines[i]?.service ?? "").trim() !== "" && Number(lines[i]?.people || 0) > 0);

  return (
    <fieldset>
      <legend className="mb-1 text-base font-semibold">Maliyet kalemleri (kişi başı, aylık)</legend>
      <p className="mb-3 text-xs text-muted">
        Brüt maaşı yazdığınız hizmette kişi başı bedel maliyet tablosundan (SGK, vergi, yol, giderler ve şirket kâr payı dahil) hesaplanır ve tablonun tamamı PDF&apos;e eklenir.
        Boş bıraktığınız hizmette 1. adımda yazdığınız bedel kullanılır.
      </p>
      {shown.length === 0 && <p className="rounded-xl bg-surface-2/60 px-4 py-3 text-sm text-muted">Önce 1. adımda hizmetleri ve kişi sayılarını girin; maliyet kalemleri kişi sayısı yazılan hizmetler için açılır.</p>}
      <div className="space-y-3">
        {shown.map(({ f, i }) => {
          const e = Array.isArray(errs) ? errs[i] : undefined;
          const line = lines[i] ?? EMPTY_LINE;
          const filled = hasCost(line);
          const cost = calcCost(lineCost(line), params, pct);
          const row = calc.lines[i];
          return (
            <div key={f.id} className="rounded-xl border border-border bg-surface-2/40 p-3 sm:p-4">
              <p className="text-sm font-semibold">
                {line.service} <span className="font-normal text-muted">· {Number(line.people || 0)} kişi</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {COST_FIELDS.map((k) => (
                  <label key={k}>
                    <span className="mb-1 block text-xs font-medium text-muted">{COST_INPUT_LABELS[k]}</span>
                    <span className="relative block">
                      <input
                        {...register(`lines.${i}.${k}`)}
                        autoComplete="off"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`${line.service}: ${COST_INPUT_LABELS[k]}`}
                        aria-invalid={e?.[k] ? true : undefined}
                        className={cn(control, "h-11 pr-8 text-right text-base")}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted">{k === "ot_hours" ? "sa" : "₺"}</span>
                    </span>
                    {e?.[k] && <span role="alert" className="mt-1 block text-xs text-danger">{e[k]?.message}</span>}
                  </label>
                ))}
              </div>
              {filled ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg bg-surface px-3 py-2.5 text-sm tabular-nums">
                    <span>Kişi başı bedel: <strong className="text-base">{formatMoney(cost.unit)}</strong> <span className="text-xs text-muted">(kâr payı {formatMoney(cost.profit)} dahil)</span></span>
                    <span>Net ele geçen: <strong>{formatMoney(cost.take_home)}</strong></span>
                    <span>Aylık bedel: <strong className="text-base">{row && row.people > 0 ? formatMoney(row.monthly_total) : "—"}</strong></span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-brand">Maliyet analiz tablosunu göster</summary>
                    <CostTable title={line.service} cost={cost} className="mt-2" />
                  </details>
                </>
              ) : (
                <p className="mt-3 rounded-lg bg-surface px-3 py-2.5 text-sm text-muted">
                  Brüt maaş boş: bu hizmette 1. adımdaki kişi başı bedel ({row && row.unit_price > 0 ? formatMoney(row.unit_price) : "yazılmadı"}) kullanılır.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * "Oranlar" penceresi: bu teklifin maliyet oranları (OPSUYON KDV'si, kıdem fon oranı, SGK / vergi / asgari ücret / mesai).
 * Varsayılanı Ayarlar'dan gelir; burada değiştirilen yalnızca bu teklife kaydedilir. Pencere formun içindedir
 * (alanlar formla birlikte gönderilir); kaydetmede oranlarda hata varsa kendiliğinden açılır.
 */
function RatesDialog({ settings }: { settings: CostParams }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { control: ctl, setValue, formState } = useFormContext<OfferValues>();
  const rates = (useWatch({ control: ctl, name: "params" }) ?? {}) as Record<string, string>;
  const base = paramsToForm(settings);
  const changed = Object.keys(base).filter((k) => (rates[k] ?? "") !== base[k]).length;
  const hasError = Boolean(formState.errors.params);

  useEffect(() => {
    if (formState.submitCount > 0 && formState.errors.params && !ref.current?.open) ref.current?.showModal();
  }, [formState.submitCount, formState.errors.params]);

  const field = (k: keyof CostParams, suffix?: string) => (
    <TextField key={k} name={`params.${k}`} label={COST_PARAM_LABELS[k]} required inputMode="decimal" suffix={suffix} />
  );

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={btn("secondary", "sm", cn(hasError && "border-danger text-danger"))}>
        <SlidersHorizontal className="size-4" aria-hidden /> Oranlar
        {hasError ? (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">hata</span>
        ) : changed > 0 ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{changed} değişti</span>
        ) : null}
      </button>
      <dialog
        ref={ref}
        aria-labelledby="rates-title"
        // dışına tıklayınca kapanır; içindeki Enter formu (teklifi) göndermesin
        onClick={(e) => e.target === ref.current && ref.current.close()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
        }}
        className="m-auto max-h-[88vh] w-[min(56rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface p-0 text-fg shadow-[0_24px_64px_rgb(12_31_69/0.28)] ring-1 ring-border backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex max-h-[88vh] flex-col">
          <div className="border-b border-border px-5 py-4">
            <h2 id="rates-title" className="text-lg font-semibold">Bu teklifin oranları</h2>
            <p className="mt-1 text-sm text-muted">
              Varsayılanlar Teklifler → Ayarlar&apos;dan gelir. Burada değiştirdikleriniz yalnızca bu teklife uygulanır ve teklifle kaydedilir; Ayarlar değişmez.
            </p>
          </div>
          <div className="space-y-5 overflow-y-auto px-5 py-4">
            <FormGrid cols={3}>
              {field("fee_vat", "%")}
              {field("severance_pct", "%")}
            </FormGrid>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Maliyet tablosu oranları</legend>
              <FormGrid cols={3}>{COST_RATE_KEYS.map((k) => field(k))}</FormGrid>
            </fieldset>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={changed === 0}
              onClick={() => setValue("params", base, { shouldDirty: true, shouldValidate: true })}
              className={btn("ghost", "md")}
            >
              Ayarlardaki varsayılanlara dön
            </button>
            <button type="button" onClick={() => ref.current?.close()} className={btn("primary", "md", "sm:min-w-28")}>
              Tamam
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Hata hangi adımın alanlarında? (kaydetmeye basınca form o adıma döner) */
function stepOfErrors(errors: FieldErrors<OfferValues>): 1 | 2 | null {
  const keys = Object.keys(errors);
  if (!keys.length) return null;
  if (keys.some((k) => (STEP1_FIELDS as readonly string[]).includes(k))) return 1;
  const le = errors.lines as unknown;
  if (le) {
    const o = le as { message?: string; root?: unknown };
    if (o.message || o.root) return 1;
    if (Array.isArray(le) && le.some((r) => r && (r.service || r.people || r.unit_price))) return 1;
  }
  return 2;
}

function Steps({ settings, editing }: { settings: CostParams; editing: boolean }) {
  const { control: ctl, setValue, formState } = useFormContext<OfferValues>();
  const { fields, append, remove } = useFieldArray({ control: ctl, name: "lines" });
  const { compare, calc, vat, fee, pct, params } = useLive();
  const [step, setStep] = useState<1 | 2>(1);
  // kaydet denemesinde hata varsa hatanın olduğu adıma dön (render sırasında durum düzeltme: effect gerekmez)
  const [seen, setSeen] = useState(0);
  if (formState.submitCount !== seen) {
    setSeen(formState.submitCount);
    const s = stepOfErrors(formState.errors);
    if (s && s !== step) setStep(s);
  }
  const go = (s: 1 | 2) => {
    setStep(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addComparison = () => {
    if (!compare) setValue("compare", true, { shouldDirty: true });
    go(2);
  };

  const tab = (s: 1 | 2, title: string, sub: string) => (
    <button
      type="button"
      onClick={() => go(s)}
      aria-current={step === s ? "step" : undefined}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        step === s ? "border-brand bg-brand-soft" : "border-border bg-surface hover:bg-surface-2/60",
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", step === s ? "bg-brand text-white" : "bg-surface-2 text-muted")}>{s}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <>
      <nav aria-label="Teklif adımları" className="mb-5 flex flex-col gap-2 sm:flex-row">
        {tab(1, "Teklif", "Müşteri ve satın aldığı hizmetler")}
        {tab(2, "Maliyet karşılaştırma", compare ? "Teklife eklendi" : "İsteğe bağlı")}
      </nav>

      {/* grid-cols-1 (minmax(0,1fr)): telefonda kutular sütunu içerik genişliğine itip sayfayı yana taşırmasın */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        {/* iki adım da DOM'da kalır (gizlenen adımın alanları kayıtlı kalsın, değerler kaybolmasın) */}
        <div className={cn("space-y-6", step !== 1 && "hidden")}>
          <section className={card}>
            <h2 className="mb-4 text-base font-semibold">Müşteri</h2>
            <FormGrid>
              <TextField name="customer_name" label="Müşteri / site adı" required large titleCase placeholder="Örn. Yıldız Sitesi Yönetimi" className="sm:col-span-2" />
              <TextField name="contact_name" label="Yetkili" large titleCase placeholder="Ad soyad" />
              <TextField name="phone" label="Telefon" type="tel" inputMode="tel" large placeholder="0532 123 45 67" />
              <TextField name="email" label="E-posta" type="email" inputMode="email" large />
              <DateField name="valid_until" label="Teklif geçerlilik tarihi" />
              <TextField name="address" label="Adres" large className="sm:col-span-2" />
              <TextareaField name="notes" label="Not (isteğe bağlı)" rows={2} className="sm:col-span-2" />
            </FormGrid>
          </section>
          <section className={card}>
            <ServiceRows fields={fields} append={() => append({ ...EMPTY_LINE })} remove={remove} />
          </section>
        </div>

        <div className={cn("space-y-6", step !== 2 && "hidden")}>
          <section className={card}>
            <CheckboxField
              name="compare"
              label="Maliyet karşılaştırmasını teklife ekle"
              hint="İşaretliyse teklif sayfasında ve PDF'te kazanç kartları, “Bugün / OPSUYON ile” karşılaştırması ve maliyet dökümü yer alır. İşaretli değilse yalnızca teklif (hizmetler ve bedeller) gönderilir."
            />
          </section>
          <div className={cn("space-y-6", !compare && "opacity-55")}>
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">OPSUYON teklifi ve oranlar</h2>
                <RatesDialog settings={settings} />
              </div>
              <FormGrid cols={3}>
                <TextField name="fee_per_person" label="OPSUYON kişi başı tutar (aylık)" required large inputMode="decimal" suffix="₺" hint={`KDV hariç. Toplam teklif = toplam kişi × bu tutar + %${formatRate(params.fee_vat)} KDV`} />
                <TextField name="profit_pct" label="Şirket kâr payı" required large inputMode="decimal" suffix="%" hint="Maliyetin üstüne eklenen kâr; maliyet kalemi girilmeyen hizmette bedelin içinden ayrılır" />
                <TextField name="vat_rate" label="KDV oranı" required large inputMode="decimal" suffix="%" hint="Hizmet faturasındaki KDV" />
              </FormGrid>
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-medium">Fiyata dahil fonlar</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  <CheckboxField name="fund_severance" label={params.severance_pct < 100 ? `Kıdem tazminatı fonu (%${formatRate(params.severance_pct)})` : "Kıdem tazminatı fonu"} />
                  <CheckboxField name="fund_leave" label="Yıllık izin fonu" />
                  <CheckboxField name="fund_holiday" label="Resmi tatil mesaisi fonu" />
                </div>
                <p className="mt-2 text-xs text-muted">İşaretlenen fon kişi başı maliyete eklenir; işaretlenmeyen PDF&apos;teki şartlarda “fiyata dahil değildir” olarak yazılır. SGK, vergi ve fon oranları yukarıdaki <strong>Oranlar</strong> düğmesinden bu teklife özel değiştirilir.</p>
              </fieldset>
            </section>
            <section className={card}>
              <CostCards fields={fields} />
            </section>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <OfferResult calc={calc} vatRate={vat} fee={fee} profitPct={pct} compare={compare} />
          <button type="submit" disabled={formState.isSubmitting} className={btn("primary", "lg", "w-full text-lg")}>
            {formState.isSubmitting && <Loader2 className="size-5 animate-spin" aria-hidden />}
            {editing ? "Değişiklikleri kaydet" : compare ? "Teklifi karşılaştırmayla kaydet" : "Teklifi kaydet"}
          </button>
          {step === 1 ? (
            <button type="button" onClick={addComparison} className={btn("secondary", "lg", "w-full")}>
              {compare ? "Maliyet karşılaştırmaya geç" : "Maliyet karşılaştırma ekle (isteğe bağlı)"} <ArrowRight className="size-5" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={() => go(1)} className={btn("secondary", "lg", "w-full")}>
              <ArrowLeft className="size-5" aria-hidden /> Teklife dön (1. adım)
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Teklif hazırlama (tablet için), iki adım:
 *  1. Teklif: müşteri ve bugün satın aldığı hizmetler (kişi sayısı, kişi başı bedel). Bu haliyle kaydedilip gönderilebilir.
 *  2. Maliyet karşılaştırma (isteğe bağlı): OPSUYON tutarı, KDV, şirket kâr payı, fonlar ve hizmet başına maliyet kalemleri.
 * Sonuç yazdıkça güncellenir; kaydedince teklifin sayfası açılır (tutarları sunucu aynı fonksiyonla yeniden hesaplar).
 * Teklifin oranları formun `params` alanındadır (yeni teklifte Ayarlar'dakiler, düzenlemede teklifle saklananlar);
 * "Oranlar" penceresinde bu teklife özel değiştirilir. `settings`: Ayarlar'daki varsayılanlar ("varsayılanlara dön" için).
 */
export function OfferForm({ defaults, settings }: { defaults: OfferValues; settings: CostParams }) {
  return (
    <Form<OfferValues> schema={offerSchema} defaultValues={defaults} action={saveOffer} resetOnSuccess={false} autoComplete="off">
      <Steps settings={settings} editing={Boolean(defaults.id)} />
    </Form>
  );
}
