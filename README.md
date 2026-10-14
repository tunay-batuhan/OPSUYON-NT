# OPSÜYON — Operasyonel Personel Süreç Yönetimi

opsuyon.com · Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage)

Güvenlik, temizlik ve kurumsal tedarik hizmetlerinde personel, puantaj, izin, bordro, fatura
ve cari hesap takibi. Hesapları **merkez** açar; müşteriler yalnızca merkezin yetkilendirdiği
bilgiye ulaşır.

## Kurulum

```bash
npm install
cp .env.example .env        # SUPABASE_URL, SUPABASE_PUBLIC_KEY, SUPABASE_SECRET_KEY
npm run dev
```

Veritabanı şeması `supabase/migrations/` altındadır ve sırayla uygulanır:

| Dosya | İçerik |
|---|---|
| `…0100_foundation` | uzantılar, hizmet alanları, izin kataloğu, roller |
| `…0200_core_access` | firma, proje, profil, proje üyeliği, izin istisnaları, RLS fonksiyonları |
| `…0300_personnel` | personel, hassas bilgiler (ayrı tablo), proje atamaları |
| `…0400_documents` | belge kategorileri, belgeler, özel Storage bucket'ı |
| `…0500_operations_finance` | puantaj, izin, fatura, ödeme, cari hesap, içe aktarma kayıtları |
| `…0600_messaging_audit` | merkez ile yazışma, işlem geçmişi |
| `…0700_public_landing` | açılış sayfası için halka açık hizmet alanları |

İlk süper yönetici:

```bash
node --env-file=.env scripts/bootstrap-admin.mjs --username=admin --name="Ad Soyad"
```

## Mimari notlar

- **Giriş:** kullanıcı adı + parola. Supabase Auth e-posta ister; `kullanici@portal.opsuyon.com`
  biçiminde iç bir adres türetilir (e-posta gönderilmez). Açık kayıt kapalıdır.
- **Yetki modeli:** `permissions` (katalog) → `roles` → `role_permissions`. Müşteri erişimi
  `project_members` (proje başına rol) + `member_permission_overrides` (kişiye özel izin ver / engelle).
  Güvenlik **RLS** ile veritabanında sağlanır; arayüzdeki gizlemeler yalnızca kolaylıktır.
- **Yeni özellik eklemek:** yeni izin = `permissions` satırı; yeni belge türü = `document_categories`
  satırı; yeni hizmet alanı = `service_lines` satırı. Yeni tablo → RLS aç, politikaları
  `app.has_project_permission(...)` ile yaz, `app.audit_row()` tetikleyicisini bağla.
- **Belgeler:** özel bucket; tarayıcı doğrudan imzalı URL ile yükler, indirme
  `/api/documents/[id]` üzerinden RLS kontrolünden sonra 60 sn'lik imzalı URL ile yapılır.
- **Gizli anahtar:** `SUPABASE_SECRET_KEY` yalnızca `src/lib/supabase/admin.ts` (server-only) içinde kullanılır.
