"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileImage, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { prepareLetterheadUpload, removeLetterhead, saveLetterhead, saveLetterheadMargins } from "@/app/actions/offers";
import { LETTERHEAD_ACCEPT, LETTERHEAD_MAX, letterheadKind, letterheadMarginsSchema, type LetterheadMarginsValues } from "@/lib/schemas-offers";
import { Form, FormGrid, SubmitButton, TextField } from "@/components/forms/form";
import { ConfirmSubmit } from "@/components/confirm-dialog";
import { btn, cn } from "@/components/ui";

/** Anteti imzalı adresle doğrudan Storage'a yükler, sonra sunucuda doğrulatıp ayarlara bağlar. */
async function uploadLetterhead(file: File): Promise<string> {
  if (!letterheadKind(file.name, file.type)) throw new Error("Antet PDF, PNG ya da JPG olmalı.");
  if (file.size === 0) throw new Error("Dosya boş.");
  if (file.size > LETTERHEAD_MAX) throw new Error("Antet dosyası 10 MB'tan büyük olamaz.");
  const prep = await prepareLetterheadUpload({ fileName: file.name, mime: file.type, size: file.size });
  if ("error" in prep) throw new Error(prep.error);
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(prep.signedUrl, { method: "PUT", body, headers: { apikey: prep.anonKey, "x-upsert": "false" } });
  if (!res.ok) throw new Error("Dosya yüklenemedi; bağlantınızı kontrol edip yeniden deneyin.");
  const saved = await saveLetterhead({ path: prep.path, fileName: file.name });
  if (saved?.error) throw new Error(saved.error);
  return saved?.message ?? "Antet kaydedildi.";
}

/**
 * Teklif PDF'lerinin antetli kağıdı: yükle / değiştir / kaldır, üst ve alt boşluk, örnek PDF.
 * Antet yoksa PDF OPSUYON logolu başlıkla çıkar.
 */
export function LetterheadCard({ letterhead, top, bottom, version }: {
  letterhead: { name: string; mime: string } | null; top: number; bottom: number; version: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await uploadLetterhead(file) });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Antet yüklenemedi." });
    } finally {
      setBusy(false);
    }
  }

  const Icon = letterhead?.mime === "application/pdf" ? FileText : FileImage;
  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-2/50 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand" aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {letterhead ? (
            <>
              <p className="font-medium [overflow-wrap:anywhere]">{letterhead.name}</p>
              <p className="text-sm text-muted">Teklif PDF&apos;leri bu antetle çıkıyor.</p>
            </>
          ) : (
            <>
              <p className="font-medium">Antet yüklenmedi</p>
              <p className="text-sm text-muted">Teklif PDF&apos;leri şimdilik OPSUYON logolu başlıkla çıkıyor.</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/teklifler/ornek?goster=1&v=${encodeURIComponent(version)}`} target="_blank" rel="noopener" className={btn("secondary", "md")}>
            <Eye className="size-4" aria-hidden /> Örnek PDF
          </a>
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className={btn("primary", "md")}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {busy ? "Yükleniyor…" : letterhead ? "Değiştir" : "Antet yükle"}
          </button>
          <input ref={input} type="file" accept={LETTERHEAD_ACCEPT} onChange={onPick} className="sr-only" tabIndex={-1} aria-label="Antet dosyası seç" />
          {letterhead && (
            <form action={removeLetterhead}>
              <ConfirmSubmit
                title="Antet kaldırılsın mı?"
                description="Teklif PDF'leri yeniden OPSUYON logolu başlıkla çıkar. Dosyayı sonra yeniden yükleyebilirsiniz."
                items={[letterhead.name]}
                confirmLabel="Kaldır"
                icon={<Trash2 className="size-4" aria-hidden />}
                className={btn("ghost", "md", "text-danger hover:bg-danger-soft hover:text-danger")}
              >
                Kaldır
              </ConfirmSubmit>
            </form>
          )}
        </div>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("rounded-lg px-3 py-2.5 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
          {msg.text}
        </p>
      )}

      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>En iyi sonuç: antetli kağıdınızın <strong className="font-medium text-fg">A4 boyutunda PDF</strong> hâli (Word&apos;den &quot;PDF olarak kaydet&quot;). İlk sayfası kullanılır.</li>
        <li>A4 oranında PNG/JPG de olur. Yalnızca üst başlık görseliniz varsa (yatay şerit) sayfanın üstüne tam genişlikte yerleşir.</li>
        <li>Teklif bilgileri antetin üst ve alt boşluğu arasına yazılır; logonuzun altına denk gelecek şekilde boşlukları ayarlayın ve <strong className="font-medium text-fg">Örnek PDF</strong> ile kontrol edin.</li>
      </ul>

      {letterhead && (
        <Form<LetterheadMarginsValues>
          schema={letterheadMarginsSchema}
          defaultValues={{ top_mm: String(top), bottom_mm: String(bottom) }}
          action={saveLetterheadMargins}
          resetOnSuccess={false}
          className="space-y-4 border-t border-border pt-5"
        >
          <FormGrid>
            <TextField name="top_mm" label="Üst boşluk" required inputMode="numeric" suffix="mm" hint="Sayfanın üstünden içeriğin başladığı yere (antet başlığının yüksekliği). Önerilen 40–60 mm." />
            <TextField name="bottom_mm" label="Alt boşluk" required inputMode="numeric" suffix="mm" hint="Antetin altındaki adres / iletişim şeridinin yüksekliği. Önerilen 20–35 mm." />
          </FormGrid>
          <SubmitButton>Boşlukları kaydet</SubmitButton>
        </Form>
      )}
    </div>
  );
}
