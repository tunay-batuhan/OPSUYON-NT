"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { btn, cn, inputCls } from "@/components/ui";
import { MONTHS } from "@/lib/format";
import type { ImportReport } from "@/lib/import/engine";
import type { ImportType } from "@/lib/import/defs";

type DefInfo = {
  type: ImportType;
  title: string;
  description: string;
  usesPeriod: "month-year" | "year" | null;
  columns: { label: string; required?: boolean; note?: string }[];
};

export function ImportWizard({ projectId, defs, defaultType }: { projectId: string; defs: DefInfo[]; defaultType?: string }) {
  const router = useRouter();
  const now = new Date();
  const [type, setType] = useState<DefInfo["type"]>(defs.find((d) => d.type === defaultType)?.type ?? defs[0].type);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [done, setDone] = useState<ImportReport | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const dropRef = useRef<HTMLLabelElement>(null);
  const def = defs.find((d) => d.type === type)!;

  const reset = () => { setReport(null); setDone(null); setError(null); };

  async function send(mode: "preview" | "commit") {
    if (!file) return setError("Önce bir Excel dosyası seçin.");
    setBusy(mode);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("project_id", projectId);
      fd.set("type", type);
      fd.set("mode", mode);
      fd.set("year", year);
      fd.set("month", month);
      fd.set("file", file);
      const res = await fetch("/api/imports", { method: "POST", body: fd });
      const json = (await res.json()) as { report?: ImportReport; error?: string };
      if (!res.ok || !json.report) throw new Error(json.error ?? "Dosya işlenemedi.");
      if (mode === "preview") { setReport(json.report); setDone(null); }
      else {
        setDone(json.report);
        setReport(null);
        setFile(null);
        setFileKey((k) => k + 1);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dosya işlenemedi.");
      if (mode === "preview") setReport(null);
    } finally {
      setBusy(null);
    }
  }

  const rows = report ? (onlyErrors ? report.rows.filter((r) => r.errors.length) : report.rows) : [];

  return (
    <div className="space-y-6 p-5">
      {/* 1. type */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">1 · Ne aktarılacak?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {defs.map((d) => (
            <label
              key={d.type}
              className={cn(
                "cursor-pointer rounded-xl border p-4 transition-colors",
                type === d.type ? "border-brand bg-brand-soft/60" : "border-border hover:bg-surface-2",
              )}
            >
              <input type="radio" name="import-type" className="sr-only" checked={type === d.type} onChange={() => { setType(d.type); reset(); }} />
              <span className="flex items-center gap-2 font-medium">
                <FileSpreadsheet className="size-4 text-brand" aria-hidden /> {d.title}
              </span>
              <span className="mt-1 block text-xs text-muted">{d.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2. template + period + file */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">2 · Şablon <span className="font-normal text-muted">(isteğe bağlı)</span></p>
          <a href={`/api/imports/template?type=${type}`} className={btn("secondary", "md")}>
            <Download className="size-4" aria-hidden /> {def.title} şablonunu indir (.xlsx)
          </a>
          <details className="mt-3 rounded-lg border border-border text-sm">
            <summary className="cursor-pointer px-3 py-2 font-medium">Tanınan sütunlar</summary>
            <ul className="divide-y divide-border border-t border-border">
              {def.columns.map((c) => (
                <li key={c.label} className="px-3 py-2">
                  <span className="font-medium">{c.label}</span>
                  {c.required && <span className="ml-1 text-danger" aria-label="zorunlu">*</span>}
                  {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                </li>
              ))}
            </ul>
          </details>
          <p className="mt-2 text-xs text-muted">Kendi Excel dosyanızı da yükleyebilirsiniz; başlıklar benzerse (Türkçe karakter/büyük-küçük harf fark etmez) otomatik eşleştirilir.</p>
        </div>

        <div className="space-y-4">
          {def.usesPeriod && (
            <div>
              <p className="mb-2 text-sm font-medium">Dönem <span className="font-normal text-muted">(dosyada ay/yıl sütunu yoksa kullanılır)</span></p>
              <div className="flex gap-2">
                {def.usesPeriod === "month-year" && (
                  <select aria-label="Ay" value={month} onChange={(e) => { setMonth(e.target.value); reset(); }} className={cn(inputCls, "w-auto")}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                )}
                <select aria-label="Yıl" value={year} onChange={(e) => { setYear(e.target.value); reset(); }} className={cn(inputCls, "w-auto")}>
                  {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">3 · Excel dosyası</p>
            <label
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) { setFile(f); reset(); }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm transition-colors hover:bg-surface-2"
            >
              <UploadCloud className="size-6 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : "Dosyayı sürükleyin veya seçmek için tıklayın (.xlsx, en fazla 10 MB)"}</span>
              <input
                key={fileKey}
                id="import-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }}
              />
            </label>
            <button onClick={() => send("preview")} disabled={!file || busy !== null} className={btn("primary", "md", "mt-3")}>
              {busy === "preview" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Önizle ve doğrula
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{error}</span>
        </div>
      )}

      {done && (
        <div role="status" className="flex items-start gap-2 rounded-lg bg-success-soft px-3 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>{done.applied}</strong> satır içe aktarıldı{done.failed ? `, ${done.failed} satır hatalı olduğu için atlandı` : ""}. Dosya işlem kaydına eklendi.
          </span>
        </div>
      )}

      {/* preview */}
      {report && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="Toplam satır" value={report.total} tone="blue" />
            <Tile label="Aktarılmaya hazır" value={report.ok} tone="emerald" />
            <Tile label="Hatalı (atlanacak)" value={report.failed} tone={report.failed ? "rose" : "teal"} />
          </div>

          <p className="text-xs text-muted">
            Sayfa: <b>{report.sheet}</b> · başlık satırı: {report.headerRow} · eşleşen sütunlar: {report.recognized.map((r) => r.label).join(", ")}
            {report.unknownHeaders.length > 0 && <> · <span className="text-warning">yok sayılan: {report.unknownHeaders.join(", ")}</span></>}
            {report.truncated && <> · <span className="text-warning">yalnızca ilk 2000 satır işlendi</span></>}
          </p>

          {report.failed > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} className="size-4 accent-[var(--brand)]" />
              Yalnızca hatalı satırları göster
            </label>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Satır</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Kayıt</th>
                  <th className="px-3 py-2">Ayrıntı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.row} className={r.errors.length ? "bg-danger-soft/40" : undefined}>
                    <td className="px-3 py-2 tabular-nums text-muted">{r.row}</td>
                    <td className="px-3 py-2">
                      {r.errors.length ? <AlertCircle className="size-4 text-danger" aria-label="Hatalı" /> : r.warnings.length ? <AlertTriangle className="size-4 text-warning" aria-label="Uyarı" /> : <CheckCircle2 className="size-4 text-success" aria-label="Hazır" />}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.title}</td>
                    <td className="px-3 py-2">
                      {r.errors.map((m) => <p key={m} className="text-danger">{m}</p>)}
                      {r.warnings.map((m) => <p key={m} className="text-warning">{m}</p>)}
                      {!r.errors.length && <p className="text-muted">{r.summary}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => send("commit")} disabled={report.ok === 0 || busy !== null} className={btn("primary", "lg")}>
              {busy === "commit" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {report.ok} satırı içe aktar
            </button>
            {report.failed > 0 && <span className="text-sm text-muted">Hatalı {report.failed} satır aktarılmaz. Dosyayı düzeltip yeniden yükleyebilirsiniz.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: "blue" | "emerald" | "rose" | "teal" }) {
  return (
    <div className="rounded-xl border border-border p-4" style={{ background: `var(--tone-${tone}-soft)` }}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: `var(--tone-${tone})` }}>{value}</p>
    </div>
  );
}
