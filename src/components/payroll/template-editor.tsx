"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { resetPayrollTemplate, savePayrollTemplate } from "@/app/actions/payroll";
import { GROUP_LABEL, KIND_LABEL, RATE_VARS, computeRow, validateTemplate, type PayCol, type PayGroup, type PayKind } from "@/lib/payroll-engine";
import { cellFmt } from "@/lib/payroll-shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { btn, cn } from "@/components/ui";
import { ActionResult } from "./action-result";
import { useAction } from "./use-action";

type Row = PayCol & { key: string };

/** Önizleme için örnek personel (müşterinin Excel'indeki değerler). */
const SAMPLE = { tanim_net_maas: 28075.5, tanim_yol: 2748, tanim_destek: 4630.7, tanim_ticket: 2748, tanim_fazla_mesai: 0, tanim_ek: 0, tanim_bes: 990.9, avans_kayit: 5000 };

const slug = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ö", "o").replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "s$1").slice(0, 30);

const inp = "h-9 w-full rounded-md border border-border bg-surface px-2 text-sm focus:border-brand focus:outline-none";
let seq = 0;
const withKeys = (cols: PayCol[]): Row[] => cols.map((c) => ({ ...c, key: `k${seq++}` }));

/**
 * Bordro şablonu düzenleyici: maaş tablosunun sütunları (başlık, kod, grup, tür) ve formülleri. Formüllerde diğer
 * sütunların kodları ve hazır değişkenler (tanim_…, avans_kayit) kullanılır. Kaydetmeden önce şablon denetlenir ve
 * örnek bir personelle her sütunun sonucu gösterilir.
 */
export function TemplateEditor({ projectId, projectName, initial, source }: {
  projectId: string | null; projectName: string | null; initial: PayCol[]; source: "proje" | "varsayilan" | "hazir";
}) {
  const [rows, setRows] = useState<Row[]>(() => withKeys(initial));
  const [touched, setTouched] = useState(false);
  const { pending, result, run } = useAction();
  const cols: PayCol[] = useMemo(
    () =>
      rows.map((r): PayCol => ({
        code: r.code.trim(), label: r.label.trim(), group: r.group, kind: r.kind,
        ...(r.kind !== "text" && r.formula?.trim() ? { formula: r.formula.trim() } : {}),
        ...(r.total && r.kind !== "text" ? { total: true } : {}),
      })),
    [rows],
  );
  const errors = useMemo(() => validateTemplate(cols), [cols]);
  const sample = useMemo(() => (errors.length ? null : computeRow(cols, {}, SAMPLE)), [cols, errors]);

  const patch = (key: string, p: Partial<Row>) => {
    setTouched(true);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };
  const move = (i: number, d: -1 | 1) => {
    setTouched(true);
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const out = [...rs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  };
  const add = () => {
    setTouched(true);
    setRows((rs) => [...rs, { key: `k${seq++}`, code: "", label: "", group: "kazanc", kind: "input", formula: "0", total: true }]);
  };
  const remove = (key: string) => {
    setTouched(true);
    setRows((rs) => rs.filter((r) => r.key !== key));
  };

  const scope = projectId ? `“${projectName}” projesi` : "Varsayılan şablon (özel şablonu olmayan tüm projeler)";
  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <strong className="text-fg">{scope}</strong> ·{" "}
          {source === "proje" ? "projeye özel şablon kullanılıyor" : source === "varsayilan" ? (projectId ? "özel şablon yok; kayıtlı varsayılan şablon gösteriliyor" : "kayıtlı varsayılan şablon") : "hazır şablon (müşterinin Excel düzeni) gösteriliyor"}
        </p>
        <div className="flex flex-wrap gap-2">
          {((projectId && source === "proje") || (!projectId && source === "varsayilan")) && (
            <ConfirmDialog
              tone="warning"
              title={projectId ? "Projeye özel şablon silinsin mi?" : "Varsayılan şablon hazır düzene dönsün mü?"}
              description={projectId ? "Proje, varsayılan şablonu kullanır. Açık dönemler “Şablonu yenile”ye basılana kadar değişmez." : "Kayıtlı varsayılan silinir; hazır (Excel) şablon geçerli olur."}
              confirmLabel={projectId ? "Özel şablonu sil" : "Hazır şablona dön"}
              onConfirm={() => run(() => resetPayrollTemplate({ project_id: projectId }), () => window.location.reload())}
            >
              <button type="button" disabled={pending} className={btn("ghost", "sm", "text-danger hover:bg-danger-soft hover:text-danger")}>
                <RotateCcw className="size-4" aria-hidden /> {projectId ? "Özel şablonu sil" : "Hazır şablona dön"}
              </button>
            </ConfirmDialog>
          )}
          <button
            type="button"
            disabled={pending || errors.length > 0 || (!touched && source !== "hazir" && !(projectId && source === "varsayilan"))}
            onClick={() => run(() => savePayrollTemplate({ project_id: projectId, columns: cols }), () => setTouched(false))}
            className={btn("primary", "sm")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            {projectId ? "Bu projeye özel kaydet" : "Varsayılan olarak kaydet"}
          </button>
        </div>
      </div>
      <ActionResult result={result} />
      {errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 rounded-xl bg-danger-soft px-8 py-3 text-sm text-danger">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="relative overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[60rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Sıra</th>
              <th className="px-2 py-2 font-medium">Başlık</th>
              <th className="px-2 py-2 font-medium">Kod</th>
              <th className="px-2 py-2 font-medium">Grup</th>
              <th className="px-2 py-2 font-medium">Tür</th>
              <th className="px-2 py-2 font-medium">Formül / ilk değer</th>
              <th className="px-2 py-2 text-center font-medium">Toplam</th>
              <th className="px-2 py-2 text-right font-medium">Örnek</th>
              <th className="px-2 py-2"><span className="sr-only">Sil</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${r.label || "Sütun"} yukarı`} className="grid size-7 place-items-center rounded text-muted hover:bg-surface-2 disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`${r.label || "Sütun"} aşağı`} className="grid size-7 place-items-center rounded text-muted hover:bg-surface-2 disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={r.label}
                    maxLength={40}
                    aria-label={`Sütun ${i + 1} başlığı`}
                    onChange={(e) => patch(r.key, { label: e.target.value, ...(r.code === "" || r.code === slug(r.label) ? { code: slug(e.target.value) } : {}) })}
                    className={cn(inp, "min-w-36")}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input value={r.code} maxLength={30} aria-label={`Sütun ${i + 1} kodu`} onChange={(e) => patch(r.key, { code: e.target.value })} className={cn(inp, "w-36 font-mono text-xs")} />
                </td>
                <td className="px-2 py-1.5">
                  <select value={r.group} aria-label={`Sütun ${i + 1} grubu`} onChange={(e) => patch(r.key, { group: e.target.value as PayGroup })} className={cn(inp, "w-28")}>
                    {(Object.keys(GROUP_LABEL) as PayGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select value={r.kind} aria-label={`Sütun ${i + 1} türü`} onChange={(e) => patch(r.key, { kind: e.target.value as PayKind })} className={cn(inp, "w-32")}>
                    {(Object.keys(KIND_LABEL) as PayKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  {r.kind === "text" ? (
                    <span className="text-xs text-muted">Not sütunu (hesaba girmez)</span>
                  ) : (
                    <input
                      value={r.formula ?? ""}
                      maxLength={300}
                      aria-label={`Sütun ${i + 1} ${r.kind === "formula" ? "formülü" : "ilk değeri"}`}
                      placeholder={r.kind === "formula" ? "örn. net_maas / 30 * gun" : "örn. 0 ya da tanim_yol"}
                      onChange={(e) => patch(r.key, { formula: e.target.value })}
                      className={cn(inp, "min-w-72 font-mono text-xs")}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {r.kind !== "text" && <input type="checkbox" checked={Boolean(r.total)} aria-label={`Sütun ${i + 1} toplam satırında`} onChange={(e) => patch(r.key, { total: e.target.checked })} className="size-4 accent-[var(--brand)]" />}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted">{r.kind !== "text" && sample ? cellFmt(r, sample.values[r.code.trim()] ?? 0) : "—"}</td>
                <td className="px-2 py-1.5 text-right">
                  <button type="button" onClick={() => remove(r.key)} aria-label={`${r.label || "Sütun"} sil`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" aria-hidden /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className={btn("secondary", "sm")}><Plus className="size-4" aria-hidden /> Sütun ekle</button>

      <div className="grid gap-4 rounded-xl border border-border bg-surface-2/40 p-4 text-sm lg:grid-cols-2">
        <div>
          <p className="font-semibold">Formül nasıl yazılır?</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
            <li>Diğer sütunlara <strong className="text-fg">kodlarıyla</strong> başvurun: <code className="font-mono text-xs text-fg">net_maas / 30 * gun</code></li>
            <li>İşlemler: <code className="font-mono text-xs text-fg">+ - * / ( )</code> · yüzde: <code className="font-mono text-xs text-fg">kazanc_toplam * 5%</code> · ondalık nokta ile: <code className="font-mono text-xs text-fg">1.5</code></li>
            <li>İşlevler: <code className="font-mono text-xs text-fg">EĞER(gun &gt;= 30; 1500; 0)</code>, <code className="font-mono text-xs text-fg">MIN(a; b)</code>, <code className="font-mono text-xs text-fg">MAX(a; b)</code>, <code className="font-mono text-xs text-fg">YUVARLA(x; 2)</code></li>
            <li><strong className="text-fg">Giriş</strong> sütunu elle doldurulur; “ilk değer” satır açılırken bir kez yazılır (sayı ya da tanim_… değişkeni).</li>
            <li><strong className="text-fg">Formül</strong> sütunu hesaplanır; maaş tablosunda bir personel için elle değiştirilebilir (formüle geri dönülebilir).</li>
            <li>“Örnek” sütunu, örnek bir personelle (net maaş 28.075,50; 30 gün) sonucu gösterir.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Hazır değişkenler</p>
          <ul className="mt-1.5 space-y-1 text-muted">
            {RATE_VARS.map((v) => (
              <li key={v.code}><code className="font-mono text-xs text-fg">{v.code}</code> — {v.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
