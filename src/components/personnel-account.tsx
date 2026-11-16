"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2, Lock, LockOpen, MessageCircle, Smartphone, UserPlus } from "lucide-react";
import { createPersonnelAccount, resetPersonnelPassword, setPersonnelAccountActive, type AccountResult } from "@/app/actions/personnel-accounts";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, Card, CardHeader, btn, cn } from "@/components/ui";

export type PersonnelAccountInfo = { username: string; is_active: boolean; last_login_at: string | null; must_change_password: boolean } | null;

const fmt = (iso: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));

/**
 * Personel kartındaki "Personel hesabı" kutusu: hesap aç, parolayı sıfırla, hesabı kapat/aç.
 * Hesap açılınca / parola sıfırlanınca kullanıcı adı ve geçici parola BİR KEZ gösterilir; WhatsApp ile gönderilebilir.
 */
export function PersonnelAccountCard({
  personnelId, fullName, account, canManage, loginUrl, terminated,
}: { personnelId: string; fullName: string; account: PersonnelAccountInfo; canManage: boolean; loginUrl: string; terminated?: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AccountResult | null>(null);
  const [copied, setCopied] = useState(false);

  const run = (fn: () => Promise<AccountResult>) =>
    start(async () => {
      setCopied(false);
      setResult(await fn());
    });

  const creds = result?.ok && result.password ? { username: result.username, password: result.password } : null;
  const message = creds
    ? `Merhaba ${fullName}, OPSÜYON personel hesabınız açıldı.\nKullanıcı adı: ${creds.username}\nGeçici parola: ${creds.password}\nGiriş: ${loginUrl}\nİlk girişte kendi parolanızı belirleyeceksiniz. Görevlerinizi ve bordrolarınızı buradan görebilirsiniz.`
    : "";

  return (
    <Card>
      <CardHeader
        title="Personel hesabı"
        description="Personel kendi telefonundan giriş yapar: kendisine atanan görevleri görür, kabul eder ya da sorun bildirir; onaylanan bordrolarını görür."
        action={
          account ? (
            <Badge tone={!account.is_active ? "neutral" : account.must_change_password ? "warning" : "success"}>
              {!account.is_active ? "Kapalı" : account.must_change_password ? "İlk giriş bekleniyor" : "Aktif"}
            </Badge>
          ) : undefined
        }
      />
      <div className="space-y-4 p-5 text-sm">
        {account ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted">Kullanıcı adı</dt>
              <dd className="mt-0.5 font-mono font-medium">{account.username}</dd>
            </div>
            <div>
              <dt className="text-muted">Son giriş</dt>
              <dd className="mt-0.5 font-medium">{account.last_login_at ? fmt(account.last_login_at) : "Henüz giriş yapmadı"}</dd>
            </div>
            <div>
              <dt className="text-muted">Giriş adresi</dt>
              <dd className="mt-0.5 font-medium">{loginUrl.replace(/^https?:\/\//, "")}</dd>
            </div>
          </dl>
        ) : (
          <p className="flex items-start gap-2 text-muted">
            <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
            {terminated ? "Ayrılmış personele hesap açılmaz." : "Bu personelin henüz hesabı yok."}
          </p>
        )}

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {!account && !terminated && (
              <button type="button" disabled={pending} onClick={() => run(() => createPersonnelAccount(personnelId))} className={btn("primary", "md")}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />} Hesap aç
              </button>
            )}
            {account && (
              <>
                <ConfirmDialog
                  title={`${fullName} için yeni geçici parola oluşturulsun mu?`}
                  description="Eski parola hemen geçersiz olur. Personel yeni geçici parolayla girip kendi parolasını belirler."
                  confirmLabel="Parolayı sıfırla"
                  tone="warning"
                  onConfirm={() => run(() => resetPersonnelPassword(personnelId))}
                >
                  <button type="button" disabled={pending || !account.is_active} className={btn("secondary", "md")}>
                    <KeyRound className="size-4" aria-hidden /> Parolayı sıfırla
                  </button>
                </ConfirmDialog>
                {account.is_active ? (
                  <ConfirmDialog
                    title={`${fullName} hesabı kapatılsın mı?`}
                    description="Personel artık giriş yapamaz; görev ve bordro kayıtları silinmez. Hesabı istediğiniz zaman yeniden açabilirsiniz."
                    confirmLabel="Hesabı kapat"
                    tone="warning"
                    onConfirm={() => run(() => setPersonnelAccountActive(personnelId, false))}
                  >
                    <button type="button" disabled={pending} className={btn("ghost", "md")}>
                      <Lock className="size-4" aria-hidden /> Hesabı kapat
                    </button>
                  </ConfirmDialog>
                ) : (
                  !terminated && (
                    <button type="button" disabled={pending} onClick={() => run(() => setPersonnelAccountActive(personnelId, true))} className={btn("secondary", "md")}>
                      <LockOpen className="size-4" aria-hidden /> Hesabı yeniden aç
                    </button>
                  )
                )}
                {pending && <Loader2 className="size-4 animate-spin self-center text-muted" aria-hidden />}
              </>
            )}
          </div>
        )}

        {result && !result.ok && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-danger">{result.error}</p>
        )}
        {result?.ok && !creds && <p role="status" className="rounded-lg bg-success-soft px-3 py-2.5 text-success">{result.message}</p>}

        {creds && (
          <div role="status" className="rounded-xl border border-success/30 bg-success-soft/60 p-4">
            <p className="font-medium text-success">{result?.ok ? result.message : ""}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-surface px-3 py-2">
                <dt className="text-xs text-muted">Kullanıcı adı</dt>
                <dd className="select-all font-mono text-base font-semibold">{creds.username}</dd>
              </div>
              <div className="rounded-lg bg-surface px-3 py-2">
                <dt className="text-xs text-muted">Geçici parola</dt>
                <dd className="select-all font-mono text-base font-semibold tracking-wider">{creds.password}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">Parola yalnızca şimdi gösterilir. Kaybolursa “Parolayı sıfırla” ile yenisini oluşturun.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={btn("primary", "md", "bg-[#1f9d55] hover:bg-[#178a49]")}
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp’ta gönder
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
                className={btn("secondary", "md")}
              >
                {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? "Kopyalandı" : "Mesajı kopyala"}
              </button>
            </div>
          </div>
        )}
        {!canManage && !account && !terminated && (
          <p className={cn("text-xs text-muted")}>Hesabı merkez ya da yetkili site müdürü açar.</p>
        )}
      </div>
    </Card>
  );
}
