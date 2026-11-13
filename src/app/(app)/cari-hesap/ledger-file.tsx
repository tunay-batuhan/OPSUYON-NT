"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, Paperclip, RefreshCw, X } from "lucide-react";
import { attachLedgerFile, prepareLedgerUpload, removeLedgerFile } from "@/app/actions/firm-ledger";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { cn } from "@/components/ui";
import { LEDGER_FILE_ACCEPT, LEDGER_FILE_MAX, ledgerFileExt } from "@/lib/schemas-ledger";

/** Dosyayı imzalı adresle doğrudan Storage'a yükler (firmanın klasörüne); Storage yolunu döner. */
export async function uploadLedgerFile(organizationId: string, file: File): Promise<string> {
  if (!ledgerFileExt(file.name)) throw new Error("Yalnızca PDF ya da görsel (JPG, PNG, WEBP, GIF) yüklenebilir");
  if (file.size > LEDGER_FILE_MAX) throw new Error("Dosya 50 MB'tan büyük olamaz");
  if (file.size === 0) throw new Error("Dosya boş");
  const prep = await prepareLedgerUpload({ organizationId, fileName: file.name, size: file.size });
  if ("error" in prep) throw new Error(prep.error);
  // supabase-js `uploadToSignedUrl` ile aynı istek (istemci paketlenmeden)
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(prep.signedUrl, { method: "PUT", body, headers: { apikey: prep.anonKey, "x-upsert": "false" } });
  if (!res.ok) throw new Error("Dosya yüklenemedi");
  return prep.path;
}

const rowBtn = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

/**
 * Hareketler tablosunda (yalnızca finans yöneticisi): dosyası olmayan kayda "Dosya ekle", dosyası olana
 * "Değiştir" (yeni dosya seçilir) ve "Kaldır". Dosya seçilince hemen yüklenir ve kayda bağlanır.
 */
export function LedgerFileActions({
  id, organizationId, hasFile, label, kindLabel,
}: { id: string; organizationId: string; hasFile: boolean; label: string; kindLabel: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const path = await uploadLedgerFile(organizationId, file);
      const res = await attachLedgerFile({ id, file_path: path, file_name: file.name });
      if (res?.error) throw new Error(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dosya yüklenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center justify-end gap-2", !error && "xl:flex-nowrap")}>
      <input ref={input} type="file" accept={LEDGER_FILE_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        aria-label={`${label} — ${hasFile ? "dosyayı değiştir" : "dosya ekle"}`}
        title={hasFile ? "Dosyayı değiştir" : "PDF ya da görsel ekle (en fazla 50 MB)"}
        className={cn(rowBtn, hasFile ? "text-fg" : "text-brand")}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : hasFile ? <RefreshCw className="size-4" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
        {/* dosyası olan satırda İndir / Görüntüle'nin yanında yer kaplamasın diye yalnızca simge */}
        {busy ? (hasFile ? null : "Yükleniyor…") : hasFile ? <span className="sr-only">Değiştir</span> : "Dosya ekle"}
      </button>
      {hasFile && !busy && (
        <form action={removeLedgerFile} className="inline">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit
            title={`${kindLabel} dosyası kaldırılsın mı?`}
            description="Yalnızca dosya kalıcı olarak silinir; kayıt ve tutar değişmez."
            items={[label]}
            confirmLabel="Kaldır"
            label={`${label} — dosyayı kaldır`}
            icon={<X className="size-4" aria-hidden />}
            className={cn(rowBtn, "text-danger hover:bg-danger-soft")}
          >
            <span className="sr-only">Kaldır</span>
          </ConfirmSubmit>
        </form>
      )}
      {error && <span role="alert" className="basis-full text-right text-xs text-danger">{error}</span>}
    </span>
  );
}

/** Formdaki dosya kutusunun görünümü (Fatura girişi / Tahsilat girişi). */
export function FileDrop({
  id, label, fileName, busy, error, onFile, onClear, hint,
}: {
  id: string; label: string; fileName: string; busy: boolean; error?: string; hint: string;
  onFile: (f: File | undefined) => void; onClear: () => void;
}) {
  return (
    <div className="sm:col-span-6">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} <span className="font-normal text-muted">(isteğe bağlı)</span>
      </label>
      <div className="flex items-stretch gap-2">
        <label
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm transition-colors hover:bg-surface-2",
            error ? "border-danger bg-danger-soft/40" : "border-border",
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-muted" aria-hidden /> : fileName ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <FileUp className="size-5 text-muted" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{busy ? "Yükleniyor…" : fileName ? `${fileName} yüklendi` : hint}</span>
          <input id={id} key={fileName || "bos"} type="file" accept={LEDGER_FILE_ACCEPT} className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && !busy && (
          <button type="button" onClick={onClear} className={cn(rowBtn, "text-muted")} aria-label="Seçilen dosyayı kaldır">
            <X className="size-4" aria-hidden /> Kaldır
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
